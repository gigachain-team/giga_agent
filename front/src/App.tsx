import React, { useRef, useState } from "react";
import styled from "styled-components";
import Chat from "./components/Chat";
import { SettingsProvider } from "./components/Settings.tsx";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar.tsx";
import DemoSettings from "./components/DemoSettings.tsx";
import { DemoItemsProvider, useDemoItems } from "./hooks/DemoItemsProvider.tsx";
import DemoChat from "./components/DemoChat.tsx";
// @ts-ignore
import { UseStream } from "@langchain/langgraph-sdk/dist/react/stream";
import { GraphState } from "./interfaces.ts";

const AppContainer = styled.div`
  display: flex;
  height: auto;
  width: 100%;
  margin: 0 auto;
  @media print {
    height: auto;
  }
`;

const InnerApp: React.FC = () => {
  const { demoItemsLoaded } = useDemoItems();
  // Можно использовать булево или просто число-счётчик
  const [reloadKey, setReloadKey] = useState(0);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const currentThreadRef = useRef<UseStream<GraphState> | null>(null);

  // эта функция будет прокидываться в SidebarComponent
  const handleNavigateAndReload = () => {
    // переключаем флаг, чтобы сделать новый key у соседнего компонента
    setReloadKey((prev) => prev + 1);
    if (currentThreadRef.current) {
      currentThreadRef.current.stop();
    }
  };

  const handleThreadIdChange = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const handleThreadReady = (thread: UseStream<GraphState>) => {
    currentThreadRef.current = thread;
  };
  if (!demoItemsLoaded) {
    return null;
  }
  return (
    <Sidebar onNewChat={handleNavigateAndReload}>
      <Routes>
        <Route
          path="/"
          element={
            <Chat
              key={reloadKey}
              onThreadIdChange={handleThreadIdChange}
              onThreadReady={handleThreadReady}
            />
          }
        />
        <Route
          path="/threads/:threadId"
          element={
            <Chat
              key={reloadKey}
              onThreadIdChange={handleThreadIdChange}
              onThreadReady={handleThreadReady}
            />
          }
        />
        <Route
          path="/demo/:demoIndex"
          element={
            <DemoChat
              key={reloadKey}
              onContinue={handleNavigateAndReload}
              onThreadIdChange={handleThreadIdChange}
              onThreadReady={handleThreadReady}
            />
          }
        />
        <Route path="/demo/settings" element={<DemoSettings />} />
      </Routes>
    </Sidebar>
  );
};

const App: React.FC = () => {
  return (
    <DemoItemsProvider>
      <SettingsProvider>
        <AppContainer>
          <BrowserRouter>
            <InnerApp />
          </BrowserRouter>
        </AppContainer>
      </SettingsProvider>
    </DemoItemsProvider>
  );
};

export default App;
