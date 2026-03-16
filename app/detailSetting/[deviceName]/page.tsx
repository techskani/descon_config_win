"use client";

import Sidebar from "@/components/Sidebar";

import React from "react";

import SelectDeviceDetail from "@/components/SelectDevice";

export default function DetailSetting() {
  return (
    <main className=" mt-14">
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
      <div
        className={`
          w-full
          sm:ml-[16.666667%] sm:w-auto
        `}
      >
        <SelectDeviceDetail />
      </div>
    </main>
  );
}
