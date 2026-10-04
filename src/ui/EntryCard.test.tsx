import { screen } from '@testing-library/react';
import { opponent, profilesFixture, warren } from '../test/data';
import { renderWithClient } from '../test/render';
import type { FollowedEntry } from '../storage/types';
import { EntryCard } from './EntryCard';

const renderCard = (entry: FollowedEntry) =>
  renderWithClient(
    <ul>
      <EntryCard entry={entry} game={null} profiles={profilesFixture} hasSchedule onMove={() => {}} onRemove={() => {}} />
    </ul>,
  );

describe('entry card sides', () => {
  it('shows the league select on my cards', () => {
    renderCard(warren);
    expect(screen.getByLabelText('League')).toHaveValue('p1');
    expect(screen.getByRole('button', { name: 'Remove Jaylen Warren from Office league' })).toBeInTheDocument();
  });

  it('names the league select for its card', () => {
    renderCard(warren);
    expect(screen.getByRole('combobox', { name: 'League for Jaylen Warren' })).toBeInTheDocument();
  });

  it('renders no league select when not movable', () => {
    renderWithClient(
      <ul>
        <EntryCard entry={warren} game={null} profiles={profilesFixture} hasSchedule movable={false} onRemove={() => {}} />
      </ul>,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('has no league select on opponent cards and names the side on Remove', () => {
    renderCard(opponent(warren));
    expect(screen.queryByLabelText('League')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Jaylen Warren from opponent side, Office league' })).toBeInTheDocument();
    expect(screen.getByText('Bye week')).toBeInTheDocument();
  });
});
