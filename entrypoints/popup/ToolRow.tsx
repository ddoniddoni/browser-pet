import { Chevron } from '../../components/Chevron';

export function ToolRow({ kind, title, describedBy }: {
  kind: 'alarm' | 'timer' | 'photo';
  title: string;
  describedBy?: string;
}) {
  return <summary className="tool-row" data-tool={kind} aria-describedby={describedBy}>
    <span className="tool-mark" aria-hidden="true" />
    <strong className="tool-label">{title}</strong>
    <Chevron />
  </summary>;
}
