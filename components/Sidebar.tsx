import Link from "next/link";
import { useContext, useEffect } from "react";
import { DataContext, DataContextType } from "@/contexts/Datacontext";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Sidebar() {
  const { filename, setFilename } = useContext<DataContextType>(DataContext);
  const router = useRouter();

  // デフォルトでdescon.yamlを選択
  useEffect(() => {
    if (!filename) {
      setFilename("descon.yaml");
    }
  }, [filename, setFilename]);

  const handleFilenameChange = (value: string) => {
    setFilename(value);
    // ルートページに戻る
    router.push("/");
  };

  return (
    <aside
      className={`
        mt-16
        flex
        flex-row             
        items-center
        gap-x-4
        justify-center
        sm:flex-col         
        sm:items-center
        sm:gap-y-4
        sm:gap-x-0
      `}
    >
      <Select onValueChange={handleFilenameChange} value={filename}>
        <SelectTrigger
          className="
            w-48
            h-12
            bg-white
            border border-blue-300
            text-blue-800
            text-base
            font-medium
            rounded-md
            shadow-sm
            focus:outline-none
            focus:ring-2
            focus:ring-blue-300
            focus:border-transparent

            /* 640px以上の画面では幅を縮めて縦並びで配置 */
            sm:w-[calc(100%-4rem)]
          "
        >
          <SelectValue placeholder="設定ファイル名" className="text-blue-800" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="descon.yaml">descon.yaml</SelectItem>
          <SelectItem value="cubicle.yaml">cubicle.yaml</SelectItem>
        </SelectContent>
      </Select>
      {/* <Link href="/deviceSetting" className="text-lg font-semibold">
          デバイス設定
      </Link> */}
    </aside>
  );
}
