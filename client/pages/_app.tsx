// client/pages/_app.tsx
import type { AppProps } from "next/app";
import { useAdminRedirect } from "../hooks/useAdminRedirect";

export default function MyApp({ Component, pageProps }: AppProps) {
  useAdminRedirect();
  return <Component {...pageProps} />;
}
