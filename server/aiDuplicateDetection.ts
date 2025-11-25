import OpenAI from "openai";
import type { SmartCase } from "@shared/schema";
import { config } from "./config";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface SimilarityMatch {
  caseId: string;
  title: string;
  description: string;
  category: string;
  similarityScore: number;
  matchReason: string;
  isDuplicate: boolean;
}

export interface DuplicateAnalysisResult {
  isUnique: boolean;
  duplicateOfId?: string;
  similarCases: SimilarityMatch[];
  analysisReason: string;
  confidenceScore: number;
  analysisCompletedAt: string;
}

export class AIDuplicateDetectionService {
  async analyzeDuplicates(
    newCase: {
      title: string;
      description: string;
      category?: string;
      propertyId?: string;
      unitId?: string;
    },
    existingCases: SmartCase[]
  ): Promise<DuplicateAnalysisResult> {
    try {
      console.log(`🔍 AI Duplicate Detection: Analyzing "${newCase.title}" against ${existingCases.length} existing cases`);

      const relevantCases = this.filterRelevantCases(newCase, existingCases);
      console.log(`📋 Filtered to ${relevantCases.length} relevant cases for comparison`);

      if (relevantCases.length === 0) {
        return {
          isUnique: true,
          similarCases: [],
          analysisReason: "No existing cases found for comparison",
          confidenceScore: 1.0,
          analysisCompletedAt: new Date().toISOString()
        };
      }

      const similarities = await this.performSemanticAnalysis(newCase, relevantCases);

      similarities.sort((a, b) => b.similarityScore - a.similarityScore);

      const potentialDuplicate = similarities.find(s => s.similarityScore > 0.85);

      const result: DuplicateAnalysisResult = {
        isUnique: !potentialDuplicate,
        duplicateOfId: potentialDuplicate?.caseId,
        similarCases: similarities.slice(0, 5),
        analysisReason: potentialDuplicate
          ? `High similarity (${(potentialDuplicate.similarityScore * 100).toFixed(1)}%) detected with case ${potentialDuplicate.caseId}`
          : "No significant duplicates found - appears to be a unique request",
        confidenceScore: potentialDuplicate ? potentialDuplicate.similarityScore : 0.95,
        analysisCompletedAt: new Date().toISOString()
      };

      console.log(`🎯 Duplicate Analysis Complete: ${result.isUnique ? 'UNIQUE' : 'DUPLICATE'} (confidence: ${(result.confidenceScore * 100).toFixed(1)}%)`);

      return result;

    } catch (error) {
      console.error("🚨 AI Duplicate Detection Error:", error);
      return {
        isUnique: true,
        similarCases: [],
        analysisReason: "Duplicate detection failed - treating as unique request",
        confidenceScore: 0.5,
        analysisCompletedAt: new Date().toISOString()
      };
    }
  }

  private async performSemanticAnalysis(
    newCase: { title: string; description: string; category?: string },
    existingCases: SmartCase[]
  ): Promise<SimilarityMatch[]> {

    const prompt = this.buildSimilarityPrompt(newCase, existingCases);

    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing maintenance requests to detect duplicates and similar issues. Focus on the core problem, location, and symptoms rather than just keywords."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Similarity analysis timeout")), 20000)
      )
    ]) as any;

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from similarity analysis");
    }

    const result = JSON.parse(content);
    return this.validateSimilarityResults(result.similarities || []);
  }

  private buildSimilarityPrompt(
    newCase: { title: string; description: string; category?: string },
    existingCases: SmartCase[]
  ): string {
    const casesList = existingCases.map((c, index) =>
      `${index + 1}. ID: ${c.id}
   Title: ${c.title}
   Description: ${c.description || 'No description'}
   Category: ${c.category || 'Uncategorized'}
   Status: ${c.status}
   Created: ${c.createdAt}`
    ).join('\n\n');

    return `
Analyze this NEW maintenance request against existing cases to detect duplicates and similar issues:

NEW REQUEST:
Title: ${newCase.title}
Description: ${newCase.description}
Category: ${newCase.category || 'Unknown'}

EXISTING CASES TO COMPARE:
${casesList}

For each existing case, analyze:
1. Same core problem?
2. Similar symptoms and circumstances?
3. Could they be the same underlying issue?

Respond with JSON in this format:
{
  "similarities": [
    {
      "caseId": "existing-case-id",
      "title": "existing case title",
      "description": "existing case description",
      "category": "existing case category",
      "similarityScore": 0.95,
      "matchReason": "Same issue - identical symptoms",
      "isDuplicate": true
    }
  ]
}

Similarity Scoring Guidelines:
- 1.0 = Identical issue
- 0.9-0.95 = Same problem
- 0.8-0.89 = Same problem type
- 0.7-0.79 = Similar problem
- 0.6-0.69 = Related issue type
- 0.5 and below = Different issues

Only include cases with similarity > 0.6. Mark isDuplicate=true for scores > 0.85.
`;
  }

  private filterRelevantCases(
    newCase: { propertyId?: string; unitId?: string; category?: string },
    existingCases: SmartCase[]
  ): SmartCase[] {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let relevantCases = existingCases.filter(c =>
      c.createdAt && new Date(c.createdAt) >= thirtyDaysAgo && c.status !== 'Closed'
    );

    if (newCase.unitId || newCase.propertyId) {
      const sameLocationCases = relevantCases.filter(c =>
        (newCase.unitId && c.unitId === newCase.unitId) ||
        (newCase.propertyId && c.propertyId === newCase.propertyId)
      );

      if (sameLocationCases.length > 0) {
        relevantCases = sameLocationCases;
      }
    }

    if (relevantCases.length > 20) {
      const sameCategoryCases = relevantCases.filter(c =>
        newCase.category && c.category === newCase.category
      );

      if (sameCategoryCases.length > 0 && sameCategoryCases.length <= 20) {
        relevantCases = sameCategoryCases;
      } else {
        relevantCases = relevantCases
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 20);
      }
    }

    return relevantCases;
  }

  private validateSimilarityResults(similarities: any[]): SimilarityMatch[] {
    return similarities
      .filter(s => s.caseId && typeof s.similarityScore === 'number')
      .map(s => ({
        caseId: s.caseId,
        title: s.title || 'No title',
        description: s.description || 'No description',
        category: s.category || 'Unknown',
        similarityScore: Math.max(0, Math.min(1, Number(s.similarityScore))),
        matchReason: s.matchReason || 'Similar maintenance request',
        isDuplicate: s.isDuplicate === true || s.similarityScore > 0.85
      }))
      .filter(s => s.similarityScore > 0.6)
      .slice(0, 10);
  }
}

export const aiDuplicateDetectionService = new AIDuplicateDetectionService();
