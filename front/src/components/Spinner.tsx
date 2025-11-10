import React from "react";
import { Loader } from "lucide-react";

interface SpinnerProps {
  size?: string; // размер, например '50px'
  color?: string; // цвет, например '#fff'
}

const Spinner: React.FC<SpinnerProps> = ({ size = "8px", color = "#fff" }) => {
  const numeric = parseInt(size as string, 10) || 12;
  return (
    <span className="inline-block" style={{ width: size, height: size, color }}>
      <Loader size={numeric} className="animate-spin" />
    </span>
  );
};

export default Spinner;
