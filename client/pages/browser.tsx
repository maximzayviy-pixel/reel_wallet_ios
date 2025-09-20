// pages/browser.tsx
import Layout from "../components/Layout";

export default function Browser() {
  return (
    <Layout title="Витрина подарков">
      <div className="flex items-center justify-center h-[70vh]">
        <img
          src="https://i.imgur.com/PwubBkx.png"
          alt="В разработке..."
          className="rounded-xl shadow-lg max-w-full"
        />
      </div>
    </Layout>
  );
}
