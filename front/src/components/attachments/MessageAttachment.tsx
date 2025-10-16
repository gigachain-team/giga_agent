import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { StoreClient } from "@langchain/langgraph-sdk/client";
import Graph from "./Graph.tsx";
import Text from "./Text.tsx";
import HTMLPage from "./HTMLPage.tsx";
import Image from "./Image.tsx";
import Audio from "./Audio.tsx";

interface MessageAttachmentProps {
  path: string;
  fullScreen?: boolean;
  alt?: string;
}

const Placeholder = styled.div`
  width: 100%;
  padding-top: 56.25%; /* подложка под изображение, чтобы не прыгал layout */
  background-color: #2d2d2d;
  position: relative;
`;

const client = new StoreClient({
  apiUrl: `${window.location.protocol}//${window.location.host}/graph`,
});

const MessageAttachment: React.FC<MessageAttachmentProps> = ({
  path,
  alt,
  fullScreen,
}) => {
  const [attachment, setAttachment] = useState<any | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    client
      .getItem(["attachments"], path)
      .then((res) => {
        setAttachment(res?.value);
      })
      .catch(() => {
        setError(true);
      });
  }, [path]);

  if (error) {
    return <div>Ошибка загрузки вложения {alt || ""}</div>;
  }
  if (!attachment) {
    return <Placeholder />; // можно заменить на спиннер или skeleton
  }
  if (attachment["file_type"] === "plotly_graph") {
    return <Graph data={attachment} alt={alt} id={path} />;
  } else if (attachment["file_type"] === "text") {
    return <Text data={attachment} alt={alt} id={path} />;
  } else if (attachment["file_type"] === "html") {
    return (
      <HTMLPage
        data={attachment}
        alt={alt}
        id={path}
        fullScreen={fullScreen ? fullScreen : false}
      />
    );
  } else if (attachment["file_type"] === "image") {
    return <Image data={attachment} alt={alt} id={path} />;
  } else if (attachment["file_type"] === "audio") {
    return <Audio data={attachment} alt={alt} id={path} />;
  }
};

export default React.memo(
  MessageAttachment,
  (prev, next) => prev.path === next.path && prev.alt === next.alt,
);
