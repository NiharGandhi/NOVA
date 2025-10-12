import { FC, KeyboardEvent } from "react";
import TypeAnimation from "./TypeAnimation";
import Image from "next/image";

type TInputAreaProps = {
  promptValue: string;
  setPromptValue: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;
  handleChat: (messages?: { role: string; content: string }[]) => void;
  ageGroup: string;
  setAgeGroup: React.Dispatch<React.SetStateAction<string>>;
  handleInitialChat: () => void;
  selectedChatbot?: string;
  setSelectedChatbot?: React.Dispatch<React.SetStateAction<string>>;
  chatbots?: any[];
};

const InitialInputArea: FC<TInputAreaProps> = ({
  promptValue,
  setPromptValue,
  disabled,
  handleInitialChat,
  ageGroup,
  setAgeGroup,
  selectedChatbot,
  setSelectedChatbot,
  chatbots = [],
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        return;
      } else {
        e.preventDefault();
        handleInitialChat();
      }
    }
  };

  return (
    <form
      className="mx-auto flex w-full flex-col items-center justify-between gap-4 sm:gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        handleInitialChat();
      }}
    >
      <div className="flex w-full items-center gap-2">
        <textarea
          placeholder="Teach me about..."
          className="block w-full resize-none rounded-lg border p-6 text-sm text-gray-900 placeholder:text-gray-400 sm:text-base"
          disabled={disabled}
          value={promptValue}
          required
          onKeyDown={handleKeyDown}
          onChange={(e) => setPromptValue(e.target.value)}
          rows={1}
        />
        <button
          disabled={disabled}
          type="submit"
          className="relative flex size-[72px] shrink-0 items-center justify-center rounded-md bg-[linear-gradient(154deg,#FF6B00_23.37%,#FF8533_91.91%)] disabled:pointer-events-none disabled:opacity-75"
        >
          {disabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <TypeAnimation />
            </div>
          )}

          <Image
            unoptimized
            src={"/up-arrow.svg"}
            alt="search"
            width={24}
            height={24}
            className={disabled ? "invisible" : ""}
          />
        </button>
      </div>
    </form>
  );
};

export default InitialInputArea;
