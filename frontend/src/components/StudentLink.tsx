import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Coach-side link to a student's profile page; clicks do not trigger the surrounding card. */
export default function StudentLink({ id, children, className = "" }: { id: number; children: ReactNode; className?: string }) {
  return (
    <Link
      to={`/students/${id}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={`hover:text-glove hover:underline ${className}`}
    >
      {children}
    </Link>
  );
}
