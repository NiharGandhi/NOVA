import Image from "next/image";

export default function Sources({
  sources,
  isLoading,
  ragSources = [],
}: {
  sources: { name: string; url: string }[];
  isLoading: boolean;
  ragSources?: any[];
}) {
  const hasWebSources = sources.length > 0;
  const hasRagSources = ragSources.length > 0;

  return (
    <div className="bg-white max-lg:-order-1 lg:flex lg:w-full lg:max-w-[300px] lg:flex-col">
      <div className="flex items-start gap-4 pb-3 lg:pb-3.5">
        <h3 className="text-base font-bold uppercase leading-[152.5%] text-black">
          sources:{" "}
        </h3>
      </div>
      <div className="flex w-full items-center gap-6 pb-4 max-lg:overflow-x-scroll lg:grow lg:flex-col lg:gap-4 lg:overflow-y-scroll lg:pb-0">
        {isLoading ? (
          <>
            <div className="h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300" />
            <div className="h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300" />
            <div className="hidden h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300 sm:block" />
            <div className="hidden h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300 sm:block" />
            <div className="hidden h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300 lg:block" />
            <div className="hidden h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300 lg:block" />
            <div className="hidden h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300 lg:block" />
            <div className="hidden h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300 lg:block" />
            <div className="hidden h-20 w-[260px] max-w-sm animate-pulse rounded-md bg-gray-300 lg:block" />
          </>
        ) : (
          <>
            {/* RAG Sources (Course Materials) */}
            {hasRagSources && (
              <>
                <div className="w-full text-xs font-semibold text-blue-900 uppercase">
                  📚 Course Materials ({ragSources.length})
                </div>
                {ragSources.map((source) => (
                  <RAGSourceCard source={source} key={source.id} />
                ))}
              </>
            )}

            {/* Web Sources */}
            {hasWebSources && (
              <>
                {hasRagSources && (
                  <div className="w-full border-t border-gray-200 my-2"></div>
                )}
                <div className="w-full text-xs font-semibold text-gray-700 uppercase">
                  🌐 Web Sources ({sources.length})
                </div>
                {sources.map((source) => (
                  <SourceCard source={source} key={source.url} />
                ))}
              </>
            )}

            {/* No sources */}
            {!hasWebSources && !hasRagSources && (
              <div className="text-sm text-gray-500">No sources available</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const RAGSourceCard = ({ source }: { source: any }) => {
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between">
        <h6 className="text-xs font-semibold text-blue-900">
          [Source {source.id}] {source.title}
        </h6>
        <span className="text-xs text-blue-600">
          {(source.similarity * 100).toFixed(0)}%
        </span>
      </div>
      {source.page && (
        <div className="text-xs text-gray-600">Page {source.page}</div>
      )}
      <div className="text-xs text-gray-700 line-clamp-3">
        {source.text}
      </div>
    </div>
  );
};

const SourceCard = ({ source }: { source: { name: string; url: string } }) => {
  return (
    <div className="flex h-[79px] w-full items-center gap-2.5 rounded-lg border border-gray-100 px-1.5 py-1 shadow-md">
      <div className="shrink-0">
        <Image
          unoptimized
          src={`https://www.google.com/s2/favicons?domain=${source.url}&sz=128`}
          alt={source.url}
          className="rounded-full p-1"
          width={36}
          height={36}
        />
      </div>
      <div className="flex min-w-0 max-w-[192px] flex-col justify-center gap-1">
        <h6 className="line-clamp-2 text-xs font-light">{source.name}</h6>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={source.url}
          className="truncate text-xs font-light text-[#1B1B16]/30"
        >
          {source.url}
        </a>
      </div>
    </div>
  );
};
