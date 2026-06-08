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
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        gap: '16px',
        padding: '8px 0',
      }}
    >
      <button
        onClick={minus}
        disabled={props.value <= 1}
        style={{
          width: '36px',
          height: '36px',
          border: '1px solid #2d6a4f',
          'border-radius': '50%',
          background: 'white',
          color: '#2d6a4f',
          'font-size': '1.2rem',
          cursor: 'pointer',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
        }}
      >
        −
      </button>
      <span
        style={{
          'font-size': '0.95rem',
          'font-weight': 600,
          'min-width': '80px',
          'text-align': 'center',
        }}
      >
        {props.value} servings
      </span>
      <button
        onClick={plus}
        disabled={props.value >= 32}
        style={{
          width: '36px',
          height: '36px',
          border: '1px solid #2d6a4f',
          'border-radius': '50%',
          background: 'white',
          color: '#2d6a4f',
          'font-size': '1.2rem',
          cursor: 'pointer',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
        }}
      >
        +
      </button>
    </div>
  );
}
