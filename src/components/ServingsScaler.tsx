import styles from './ServingsScaler.module.css';

interface Props {
  value: number;
  onChange: (n: number) => void;
}

export default function ServingsScaler(props: Props) {
  function minus() {
    if (props.value > 1) props.onChange(props.value - 1);
  }
  function plus() {
    if (props.value < 32) props.onChange(props.value + 1);
  }

  return (
    <div class={styles.scaler}>
      <button
        class={styles.btn}
        onClick={minus}
        disabled={props.value <= 1}
      >
        −
      </button>
      <span class={styles.label}>
        {props.value} servings
      </span>
      <button
        class={styles.btn}
        onClick={plus}
        disabled={props.value >= 32}
      >
        +
      </button>
    </div>
  );
}
