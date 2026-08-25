import { Rocket, Zap } from "lucide-react";
import { cn } from "../lib/utils";

interface FrontDoorProps {
  onChoose: (path: "create" | "grow") => void;
}

export function FrontDoor({ onChoose }: FrontDoorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-(--sz-60vh) px-8">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold tracking-tight">
          欢迎使用 Paperclip
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          您想如何开始？
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        <button
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-border p-6",
            "hover:border-foreground hover:bg-accent/30 transition-all",
            "text-center group cursor-pointer",
          )}
          onClick={() => onChoose("create")}
        >
          <div className="rounded-full bg-muted/50 p-3 group-hover:bg-accent transition-colors">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">创建新公司</h3>
            <p className="text-xs text-muted-foreground mt-1">
              从使命开始，引入主管代理，并组建代理团队来完成工作。
            </p>
          </div>
        </button>

        <button
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-border p-6",
            "hover:border-foreground hover:bg-accent/30 transition-all",
            "text-center group cursor-pointer",
          )}
          onClick={() => onChoose("grow")}
        >
          <div className="rounded-full bg-muted/50 p-3 group-hover:bg-accent transition-colors">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">将代理添加到您的组织</h3>
            <p className="text-xs text-muted-foreground mt-1">
              将 AI 代理引入您现有的团队或工作流程。
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
