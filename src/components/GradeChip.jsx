import { gradeColor } from "../lib/helpers";

export default function GradeChip({ grade }) {
  if (!grade) return null;
  const color = gradeColor(grade);

  return (
    <span
      className="grade-chip"
      style={{ color, borderColor: color, background: `${color}18` }}
    >
      Grade {grade}
    </span>
  );
}
