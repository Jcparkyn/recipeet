import { getConversions } from '@/lib/conversions';
import styles from './ConversionPopover.module.css';

interface Props {
  quantity: number;
  unit: string;
  ingredientName?: string;
  onClose: () => void;
}

export default function ConversionPopover(props: Props) {
  const conversions = () =>
    getConversions(props.quantity, props.unit, props.ingredientName);

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.popover} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <strong>{props.quantity} {props.unit}</strong>
          {props.ingredientName && (
            <span class={styles.name}>{props.ingredientName}</span>
          )}
        </div>
        <div class={styles.list}>
          {conversions().map((c) => (
            <div class={styles.row}>
              <span class={styles.value}>{c.label}</span>
            </div>
          ))}
          {conversions().length === 0 && (
            <span class={styles.empty}>No conversions available</span>
          )}
        </div>
      </div>
    </div>
  );
}
