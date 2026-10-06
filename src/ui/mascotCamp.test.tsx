import { act, render, screen } from '@testing-library/react';
import { MascotSays } from './Mascot';
import { registerCampMascot } from './dialogsOpen';

describe('an empty state while Rookie camp has the mascot', () => {
  it('shows its sentence and buttons as plain text, then talks again when the camp is over', () => {
    render(<MascotSays text="Nobody here yet."><button>Add player</button></MascotSays>);
    expect(document.querySelector('.bubble')).not.toBeNull();

    let release = () => {};
    act(() => { release = registerCampMascot(); });
    expect(document.querySelector('.bubble')).toBeNull();
    expect(document.querySelector('.mascot')).toBeNull();
    expect(screen.getByText('Nobody here yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add player' })).toBeInTheDocument();

    act(() => release());
    expect(document.querySelector('.bubble')).not.toBeNull();
  });
});
