import { Portal } from 'solid-js/web';
import { getConversions, displayQuantity } from '@/lib/conversions';
import { formatQuantity } from '@/lib/scaling';
import type { Quantity } from '@/lib/types';
import styles from './ConversionPopover.module.css';

interface Props {
  quantity: Quantity;
  ingredientName?: string;
  onClose: () => void;
}

export default function ConversionPopover(props: Props) {
  const conversions = () =>
    getConversions(props.quantity, props.ingredientName);
  const display = () => displayQuantity(props.quantity);

  return (
    <Portal>
      <div class={styles.overlay} onClick={props.onClose}>
        <div class={styles.popover} onClick={(e) => e.stopPropagation()}>
          <div class={styles.header}>
            <strong>{formatQuantity(display().quantity)} {display().unit}</strong>
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
    </Portal>
  );
}
