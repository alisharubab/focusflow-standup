import { Tag } from "@/types/ff";

export function TagPill({ tag, small = false }: { tag: Tag; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]"} font-medium`}
      style={{
        backgroundColor: `${tag.color}1F`,
        borderColor: `${tag.color}4D`,
        color: tag.color,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  );
}
