"use client";

import List from "@/components/List";
import Sidebar from "@/components/Sidebar";
import CubicleList from "@/components/CubicleList";
import { useContext } from "react";
import { DataContext, DataContextType } from "@/contexts/Datacontext";

export default function Home() {
  const { filename } = useContext<DataContextType>(DataContext);

  return (
    <main className="mt-14">
      {/* Sidebar */}
      <div
        className={`
          border-gray-300 
          w-full border-b-4 h-auto 
          sm:w-1/6 sm:border-r-4 sm:border-b-0 
          sm:fixed sm:top-14 sm:left-0 sm:h-screen
        `}
      >
        <Sidebar />
      </div>

      {/* メインコンテンツ */}
      <div
        className={`
          w-full
          sm:ml-[16.666667%] sm:w-auto
        `}
      >
        {filename === "cubicle.yaml" ? <CubicleList /> : <List />}
      </div>
    </main>
  );
}
