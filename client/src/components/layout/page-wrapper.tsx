import Sidebar from './sidebar';
import Header from './header';

interface PageWrapperProps {
  title: string;
  children: React.ReactNode;
  embedded?: boolean;
  testId?: string;
}

export default function PageWrapper({ title, children, embedded = false, testId }: PageWrapperProps) {
  if (embedded) {
    return <div data-testid={testId}>{children}</div>;
  }

  return (
    <div className="flex h-screen bg-background" data-testid={testId}>
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
