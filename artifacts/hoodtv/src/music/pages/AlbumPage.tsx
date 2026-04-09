import { useLocation } from "wouter";
import { useEffect } from "react";

export function AlbumPage() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/music", { replace: true });
  }, []);
  return null;
}
