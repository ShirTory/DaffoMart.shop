import type { Metadata } from "next";
import TrackForm from "@/components/store/TrackForm";
export const metadata: Metadata = { title: "Track Order", robots: { index: false, follow: false } };
export default function TrackPage() { return <TrackForm />; }
