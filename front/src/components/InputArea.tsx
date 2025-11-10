import React, { useState, useRef, useEffect, useCallback } from "react";
import { HumanMessage } from "@langchain/langgraph-sdk";
import { Check, Paperclip, Send, X } from "lucide-react";
import { useSettings } from "./Settings.tsx";
import { useFileUpload, UploadedFile } from "../hooks/useFileUploads";
import { useSelectedAttachments } from "../hooks/SelectedAttachmentsContext.tsx";
import {
  AttachmentBubble,
  AttachmentsContainer,
  CircularProgress,
  CloseButton,
  EnlargedImage,
  ImagePreview,
  Overlay,
  ProgressOverlay,
  RemoveButton,
} from "./Attachments.tsx";
import { FileData, GraphState, GraphTemplate } from "../interfaces.ts";
import { BROWSER_USE_NAME } from "../config.ts";
import { UseStream } from "@langchain/langgraph-sdk/react";
import { useRagContext } from "@/components/rag/providers/RAG.tsx";

const MAX_TEXTAREA_HEIGHT = 200; // макс высота в px

// Прочие стили для превью и оверлея оставляем без изменений...

interface InputAreaProps {
  thread?: UseStream<GraphState, GraphTemplate>;
}

const InputArea: React.FC<InputAreaProps> = ({ thread }) => {
  const [message, setMessage] = useState("");
  const { collections } = useRagContext();
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { settings } = useSettings();
  const { uploads, uploadFiles, removeUpload, resetUploads } = useFileUpload();
  const { selected, clear } = useSelectedAttachments();

  const selectedCount = Object.keys(selected).length;

  const isUploading = uploads.some((u) => u.progress < 100 && !u.error);
  const handleSendMessage = useCallback(
    async (content: string, files?: FileData[]) => {
      const newMessage = {
        type: "human",
        content: content,
        additional_kwargs: {
          user_input: content,
          files: files,
          selected: selected,
        },
      } as HumanMessage;
      clear();
      thread?.submit(
        { messages: [newMessage], collections: collections },
        {
          optimisticValues(prev) {
            const prevMessages = prev.messages ?? [];
            const newMessages = [...prevMessages, newMessage];
            return { ...prev, messages: newMessages };
          },
          streamMode: ["messages"],
          onDisconnect: "continue",
        },
      );
    },
    [thread, selected, clear, collections],
  );
  const handleContinueThread = useCallback(
    async (data: any) => {
      thread?.submit(undefined, {
        command: { resume: data },
        optimisticValues(prev) {
          if (!data.message) return {};
          const prevMessages = prev.messages ?? [];
          const newMessages = [
            ...prevMessages,
            {
              type: "tool",
              content: `"<decline>${data.message}</decline>"`,
            },
          ];
          return { ...prev, messages: newMessages };
        },
        onDisconnect:
          // @ts-ignore
          thread?.messages.at(-1).tool_calls[0]?.name === BROWSER_USE_NAME
            ? "cancel"
            : "continue",
      });
    },
    [thread],
  );

  // автоподгон высоты
  const autoResize = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${newHeight}px`;
  };

  // при первом рендере и при очистке
  useEffect(() => {
    autoResize();
  }, [message]);

  const handleContinue = useCallback(
    (type: "comment" | "approve") => {
      void handleContinueThread({ type, message });
      setMessage("");
    },
    [setMessage, handleContinueThread, message],
  );

  useEffect(() => {
    if (
      thread?.interrupt &&
      thread?.interrupt.value &&
      thread.interrupt.value.type === "approve" &&
      settings.autoApprove
    ) {
      handleContinue("approve");
    }
  }, [thread, settings.autoApprove, handleContinue]);

  const handleSend = () => {
    if (!message.trim() && uploads.length === 0) return;
    const attachments = uploads.map((u) => u.data).filter(Boolean);
    void handleSendMessage(message, attachments as any);
    setMessage("");
    resetUploads();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!thread?.isLoading && !isUploading) {
        if (thread?.interrupt) {
          handleContinue(message ? "comment" : "approve");
        } else {
          handleSend();
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  return (
    <div className="p-4 bg-card dark:bg-input border-border rounded-lg shadow-[2px_2px_12px_6px_rgba(0,0,0,0.04)] dark:shadow-[2px_2px_12px_6px_rgba(0,0,0,0.14)] print:hidden border-t-1 border-highlight">
      <div className="flex items-end gap-2 relative">
        <input
          className="hidden"
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          disabled={thread?.isLoading}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={thread?.isLoading}
          title="Добавить вложения"
          className="w-10 h-10 p-0 rounded-full text-foreground flex items-center justify-center transition-colors cursor-pointer disabled:bg-secondary disabled:cursor-not-allowed"
        >
          <Paperclip />
        </button>

        <textarea
          placeholder="Спросите что-нибудь…"
          ref={textRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={thread?.isLoading}
          className="flex-1 min-h-[60px] max-h-[200px] resize-none font-sans p-3 rounded-md text-foreground placeholder:text-muted-foreground overflow-y-auto outline-none border-0 disabled:opacity-60"
        />
        {thread?.interrupt &&
        thread?.interrupt.value &&
        thread.interrupt.value.type === "approve" &&
        !settings.autoApprove ? (
          <>
            <button
              onClick={() => handleContinue("comment")}
              disabled={thread.isLoading}
              title="Отменить выполнение"
              className="w-10 h-10 p-0 rounded-full bg-red-600 text-white flex items-center justify-center transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              <X />
            </button>
            <button
              onClick={() => handleContinue("approve")}
              disabled={thread.isLoading}
              title="Подтвердить выполнение"
              className="w-10 h-10 p-0 rounded-full bg-green-600 text-white flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-60"
            >
              <Check />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={thread?.isLoading || !message.trim() || isUploading}
            title="Отправить"
            className="w-10 h-10 p-0 rounded-full text-foreground flex items-center justify-center transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60"
          >
            <Send />
          </button>
        )}
      </div>

      {uploads.length > 0 && (
        <AttachmentsContainer>
          {uploads.map((u: UploadedFile, idx) => (
            <AttachmentBubble
              key={idx}
              onClick={() => u.previewUrl && setEnlargedImage(u.previewUrl!)}
            >
              {u.previewUrl ? (
                <ImagePreview src={u.previewUrl} />
              ) : (
                <span>{u.file.name}</span>
              )}

              {u.progress < 100 && (
                <ProgressOverlay>
                  <CircularProgress progress={u.progress}>
                    {u.progress}%
                  </CircularProgress>
                </ProgressOverlay>
              )}

              <RemoveButton
                onClick={(e) => {
                  e.stopPropagation();
                  removeUpload(idx);
                }}
              >
                ×
              </RemoveButton>
            </AttachmentBubble>
          ))}
        </AttachmentsContainer>
      )}

      <div
        className={[
          "absolute bottom-2 left-[75px] text-muted-foreground text-xs pointer-events-none transition-opacity duration-100",
          selectedCount > 0
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-1",
        ].join(" ")}
      >
        Выбрано вложений: {selectedCount}
      </div>

      {enlargedImage && (
        <Overlay onClick={() => setEnlargedImage(null)}>
          <EnlargedImage src={enlargedImage} />
          <CloseButton onClick={() => setEnlargedImage(null)}>×</CloseButton>
        </Overlay>
      )}
    </div>
  );
};

export default InputArea;
