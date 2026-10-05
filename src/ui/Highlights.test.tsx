import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import summary from '../test/fixtures/summary-pit-cle.json';
import { profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const clip = (id: number, headline: string, links: unknown) => ({ id, headline, originalPublishDate: `2026-10-02T00:${10 + id}:00Z`, duration: 31, links });
const videos = [
  clip(11, 'Warren breaks a tackle for 22 yards', { source: { href: 'https://cdn.example/warren.mp4' }, web: { href: 'https://www.espn.com/video/clip/_/id/11' } }),
  clip(12, 'Warren scores from the one', { web: { href: 'https://www.espn.com/video/clip/_/id/12' } }),
  clip(13, 'Someone else makes a catch', { source: { href: 'https://cdn.example/other.mp4' } }),
];
const tags = (id: string) => ({ videos: [{ categories: [{ type: 'team' }, ...(id === '13' ? [{ type: 'athlete', athleteId: 999 }] : [{ type: 'athlete', athleteId: Number(warren.espnId) }])] }] });
const routes = {
  scoreboard: scoreboardFixture,
  'summary?event=401872964': { ...summary, videos },
  'video/clips/11': tags('11'), 'video/clips/12': tags('12'), 'video/clips/13': tags('13'),
};

describe('highlights', () => {
  it('shows a button with the count of this player\'s clips only, marked new until one is opened', async () => {
    seed([warren], profilesFixture);
    mockFetch(routes);
    renderAt('/');
    const button = await screen.findByRole('button', { name: /New highlights for Jaylen Warren, 2/ });
    expect(button).toHaveClass('fresh');
  });

  it('plays a clip that has a video file inside a native dialog', async () => {
    seed([warren], profilesFixture);
    mockFetch(routes);
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /highlights for Jaylen Warren/i }));
    const dialog = await screen.findByRole('dialog', { name: /Highlights, Jaylen Warren/ });
    expect(within(dialog).queryByText('Someone else makes a catch')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /Warren breaks a tackle/ }));
    const video = dialog.querySelector('video')!;
    expect(video).toHaveAttribute('src', 'https://cdn.example/warren.mp4');
    expect(video).toHaveAttribute('controls');
    expect(screen.getByRole('button', { name: /New highlights for Jaylen Warren, 2/ })).toHaveClass('fresh'); // one clip is still unopened
    vi.spyOn(window, 'open').mockReturnValue(null);
    await userEvent.click(within(dialog).getByRole('button', { name: /Warren scores from the one/ }));
    expect(screen.getByRole('button', { name: /^Highlights for Jaylen Warren, 2/ })).not.toHaveClass('fresh');
  });

  it('opens a clip that only has a page in a new window, without a video', async () => {
    seed([warren], profilesFixture);
    mockFetch(routes);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /highlights for Jaylen Warren/i }));
    const dialog = await screen.findByRole('dialog', { name: /Highlights, Jaylen Warren/ });
    await userEvent.click(within(dialog).getByRole('button', { name: /Warren scores from the one/ }));
    expect(open).toHaveBeenCalledWith('https://www.espn.com/video/clip/_/id/12', '_blank', 'noopener,noreferrer');
    expect(dialog.querySelector('video')).toBeNull();
  });

  it('shows no button when no clip is tagged with the player', async () => {
    seed([warren], profilesFixture);
    mockFetch({ ...routes, 'video/clips/11': tags('13'), 'video/clips/12': tags('13') });
    renderAt('/');
    await screen.findByText('Jaylen Warren');
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /highlights for/i })).not.toBeInTheDocument());
  });
});
