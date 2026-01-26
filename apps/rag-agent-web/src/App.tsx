import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { Admin } from '@/pages/Admin';
import { Conversations } from '@/pages/Conversations';

function App() {
  const [route, setRoute] = useState(() => window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Admin route
  if (route === '#/admin') {
    return <Admin />;
  }

  // Conversations route
  if (route === '#/conversations') {
    return <Conversations />;
  }

  // Default: Chat
  return (
    <AppLayout>
      <ChatContainer />
    </AppLayout>
  );
}

export default App;
