export interface ListingDescriptionProps {
  text: string;
  className?: string;
}

/**
 * The API sends descriptions as plain text with paragraphs separated by a
 * blank line (MVP/backend/app/text.py). Render one <p> per paragraph; React
 * escapes the text, so anything markup-shaped shows as text, never as HTML.
 */
export function ListingDescription({ text, className }: ListingDescriptionProps) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="max-w-3xl space-y-4">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={`whitespace-pre-line ${className ?? ""}`}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export default ListingDescription;
