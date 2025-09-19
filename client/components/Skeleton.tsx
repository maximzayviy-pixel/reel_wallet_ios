import { motion } from "framer-motion";

export default function Skeleton({ className="" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-slate-200 rounded-xl ${className}`}>
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
    </div>
  );
}
