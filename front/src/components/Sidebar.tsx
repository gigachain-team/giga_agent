import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Plus,
  Printer,
  Settings as SettingsIcon,
  Trash2,
  MessageSquare,
} from "lucide-react";
import axios from "axios";
// @ts-ignore
import LogoImage from "../assets/logo.png";
// @ts-ignore
import QRImage from "../assets/qr.png";
import { useSettings } from "./Settings.tsx";

interface ThreadItem {
  thread_id: string;
  title: string;
  created_at: string;
}

const SIDEBAR_WIDTH = 250;

const Sidebar = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: ${SIDEBAR_WIDTH}px;
  height: 100%;
  padding: 20px;
  background-color: #212121d9;
  backdrop-filter: blur(20px);
  box-shadow: 0 0 ${(props) => (props.isOpen ? "50px" : `0`)} #00000075;
  border-radius: 0 8px 8px 0;
  z-index: 100;
  transform: translateX(
    ${(props) => (props.isOpen ? "0" : `-${SIDEBAR_WIDTH}px`)}
  );
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  @media (max-width: 900px) {
    border-radius: 0;
  }

  @media print {
    display: none;
  }
`;

const Overlay = styled.div<{ isOpen: boolean }>`
  display: none;

  /* показываем оверлей только на мобильных */
  @media (max-width: 900px) {
    display: ${(props) => (props.isOpen ? "block" : "none")};
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 50;
  }

  @media print {
    display: none;
  }
`;

const Main = styled.div<{ isOpen: boolean }>`
  display: flex;
  height: 100vh;
  width: 100%;
  margin: 0 auto;
  transition: margin-left 0.3s ease;

  /* на больших экранах сдвигаем, на малых — нет */
  @media (max-width: 900px) {
    max-height: calc(100vh - 75px);
  }
  @media (min-width: 900px) {
    margin-left: ${(props) => (props.isOpen ? `${SIDEBAR_WIDTH}px` : "0")};
  }

  @media print {
    margin-left: 0 !important;
  }
`;

const Opener = styled.button<{ isOpen: boolean }>`
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 200;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #fff;
  transition: left 0.3s ease;

  @media print {
    & svg {
      display: none;
    }
  }
`;

const Logo = styled.div`
  width: 156px;
  height: 40px;
  background-image: url(${LogoImage});
  background-size: cover;
`;

const QR = styled.div`
  width: 150px;
  height: 150px;
  margin-top: 8px;
  background-image: url(${QRImage});
  background-size: cover;
`;

const MenuItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  font-size: 14px;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  svg {
    margin-right: 0.5rem;
  }
`;

const CheckboxContainer = styled.label`
  display: flex;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #fff;
`;

const HiddenCheckbox = styled.input.attrs({ type: "checkbox" })`
  border: 0;
  clip: rect(0 0 0 0);
  clippath: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const StyledCheckbox = styled.div<{ checked: boolean }>`
  width: 16px;
  height: 16px;
  background: ${(p) => (p.checked ? "#4caf50" : "#555")};
  border-radius: 4px;
  transition: all 150ms;
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    visibility: ${(p) => (p.checked ? "visible" : "hidden")};
  }
`;

const ThreadListContainer = styled.div`
  margin-top: 16px;
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 400px);
`;

const ThreadListTitle = styled.div`
  font-size: 12px;
  color: #888;
  padding: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ThreadItem = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  font-size: 13px;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  background-color: ${(p) => (p.isActive ? "rgba(255, 255, 255, 0.15)" : "transparent")};
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

const ThreadTitle = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  svg {
    margin-right: 8px;
    flex-shrink: 0;
  }
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s;
  ${ThreadItem}:hover & {
    opacity: 1;
  }
  &:hover {
    color: #ff6b6b;
  }
`;

interface SidebarProps {
  children: React.ReactNode;
  onNewChat: () => void;
}

const SidebarComponent = ({ children, onNewChat }: SidebarProps) => {
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId?: string }>();
  const { settings, setSettings } = useSettings();
  const [threads, setThreads] = useState<ThreadItem[]>([]);

  const fetchThreads = async () => {
    try {
      const response = await axios.get("/graph/threads/");
      setThreads(response.data);
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    }
  };

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSettings({ ...settings, ...{ sideBarOpen: !settings.sideBarOpen } });
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.print();
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/demo/settings");
  };

  const handleAutoApproveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, ...{ autoApprove: e.target.checked } });
  };

  const handleNewChat = () => {
    navigate("/");
    onNewChat();
    fetchThreads();
  };

  const handleThreadClick = (id: string) => {
    navigate(`/threads/${id}`);
  };

  const handleDeleteThread = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await axios.delete(`/graph/threads/${id}/`);
      setThreads(threads.filter((t) => t.thread_id !== id));
      if (threadId === id) {
        navigate("/");
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  return (
    <>
      <Overlay isOpen={settings.sideBarOpen} onClick={toggle} />
      <Sidebar isOpen={settings.sideBarOpen}>
        <Logo style={{ opacity: 0, marginBottom: "0.5rem" }} />
        <MenuItem onClick={handleNewChat}>
          <Plus size={24} />
          Новый чат
        </MenuItem>
        <MenuItem onClick={handlePrint}>
          <Printer size={24} />
          Печать
        </MenuItem>
        <MenuItem onClick={handleSettings}>
          <SettingsIcon size={24} />
          Настройки демо
        </MenuItem>
        <CheckboxContainer>
          <HiddenCheckbox
            checked={settings.autoApprove ?? false}
            onChange={handleAutoApproveChange}
          />
          <StyledCheckbox checked={settings.autoApprove ?? false}>
            <Check size={12} />
          </StyledCheckbox>
          <span style={{ marginLeft: 8 }}>Auto Approve</span>
        </CheckboxContainer>
        <ThreadListContainer>
          <ThreadListTitle>История диалогов</ThreadListTitle>
          {threads.map((thread) => (
            <ThreadItem
              key={thread.thread_id}
              isActive={threadId === thread.thread_id}
              onClick={() => handleThreadClick(thread.thread_id)}
            >
              <ThreadTitle>
                <MessageSquare size={16} />
                <span>{thread.title}</span>
              </ThreadTitle>
              <DeleteButton
                onClick={(e) => handleDeleteThread(e, thread.thread_id)}
                title="Удалить диалог"
              >
                <Trash2 size={14} />
              </DeleteButton>
            </ThreadItem>
          ))}
        </ThreadListContainer>
        <QR />
      </Sidebar>

      <Opener isOpen={settings.sideBarOpen} onClick={toggle}>
        <Logo />
        <ChevronRight
          style={{
            transform: settings.sideBarOpen ? "rotate(180deg)" : "rotate(0)",
            marginLeft: "0.5rem",
          }}
        />
      </Opener>

      <Main isOpen={settings.sideBarOpen}>{children}</Main>
    </>
  );
};

export default SidebarComponent;
