import { Portal } from 'solid-js/web';
import styles from './ConfirmDialog.module.css';

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog(props: Props) {
  return (
    <Portal>
      <div class={styles.overlay} onClick={props.onCancel}>
        <div class={styles.dialog} onClick={(e) => e.stopPropagation()}>
          <p class={styles.message}>{props.message}</p>
          <div class={styles.actions}>
            <button class={styles.cancelBtn} onClick={props.onCancel}>Cancel</button>
            <button class={styles.confirmBtn} onClick={props.onConfirm}>{props.confirmLabel ?? 'Delete'}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
