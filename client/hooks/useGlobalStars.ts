// hooks/useGlobalStars.ts
import { useEffect, useState } from "react";
import { onStars } from "../lib/bus";

export default function useGlobalStars() {
  const [stars, setStars] = useState<number>(0);

  useEffect(() => {
    const cached =
      (typeof window !== "undefined" &&
        Number(localStorage.getItem("global_stars") || 0)) || 0;
    if (!Number.isNaN(cached)) setStars(cached);

    return onStars(({ stars }) => setStars(stars));
  }, []);

  return stars;
}
