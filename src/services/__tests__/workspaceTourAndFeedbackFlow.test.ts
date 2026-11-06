import { describe, expect, it } from 'vitest';
import appSrc from '../../App.tsx?raw';
import dashboardSrc from '../../components/AnalyticsDashboardPage.tsx?raw';
import modalSrc from '../../components/CreateSessionModal.tsx?raw';
import guidedTourSrc from '../../components/GuidedTour.tsx?raw';
import motivationSrc from '../../components/MotivationWelcome.tsx?raw';
import workspaceTourSrc from '../../components/WorkspaceTour.tsx?raw';

describe('New client welcome -> Workspace Tour -> Charts -> Feedback Popup order & alignment', () => {
  it('syncs every WorkspaceTour setup step (setup-mode, setup-market, setup-schedule, setup-details) with the 3-step CreateSessionModal wizard so no target is ever hidden', () => {
    // WorkspaceTour maps setup-mode -> 1, setup-market & setup-schedule -> 2, setup-details -> 3
    expect(workspaceTourSrc).toContain(
      "const wizardStep:1|2|3=step.id==='setup-mode'?1:(step.id==='setup-market'||step.id==='setup-schedule')?2:3;"
    );
    expect(workspaceTourSrc).toContain('onOpenSessionSetup(wizardStep)');

    // CreateSessionModal accepts tourWizardStep and switches wizardStep accordingly
    expect(modalSrc).toContain('tourWizardStep?: 1 | 2 | 3 | null;');
    expect(modalSrc).toContain('setWizardStep(tourWizardStep);');

    // Verify each data-tour target exists inside its corresponding wizardStep block in CreateSessionModal
    const step1Idx = modalSrc.indexOf('wizardStep === 1');
    const step2Idx = modalSrc.indexOf('wizardStep === 2');
    const step3Idx = modalSrc.indexOf('wizardStep === 3');
    expect(step1Idx).toBeGreaterThan(0);
    expect(step2Idx).toBeGreaterThan(step1Idx);
    expect(step3Idx).toBeGreaterThan(step2Idx);

    const setupModeIdx = modalSrc.indexOf('data-tour="setup-mode"');
    const setupMarketIdx = modalSrc.indexOf('data-tour="setup-market"');
    const setupScheduleIdx = modalSrc.indexOf('data-tour="setup-schedule"');
    const setupDetailsIdx = modalSrc.indexOf('data-tour="setup-details"');

    // setup-mode is in wizardStep === 1
    expect(setupModeIdx).toBeGreaterThan(step1Idx);
    expect(setupModeIdx).toBeLessThan(step2Idx);

    // setup-market and setup-schedule are in wizardStep === 2 and are separate siblings
    expect(setupMarketIdx).toBeGreaterThan(step2Idx);
    expect(setupMarketIdx).toBeLessThan(step3Idx);
    expect(setupScheduleIdx).toBeGreaterThan(setupMarketIdx);
    expect(setupScheduleIdx).toBeLessThan(step3Idx);

    // setup-details is in wizardStep === 3
    expect(setupDetailsIdx).toBeGreaterThan(step3Idx);
  });

  it('shows MotivationWelcome first on first login, then opens WorkspaceTour once dismissed, without competing ChartAnnouncement auto-popup', () => {
    // ChartAnnouncement only opens when manually clicked ("What's new"), not competing with MotivationWelcome
    expect(dashboardSrc).toContain(
      "open={announcementManual&&sidebarSection==='dashboard'&&!isSessionSetupOpen}"
    );
    // WorkspaceTour is blocked while welcomeBlocking is active
    expect(dashboardSrc).toContain('blocked={announcementManual||welcomeBlocking}');
    expect(appSrc).toContain('welcomeBlocking={motivationOpen || !motivationSettled}');

    // MotivationWelcome notifies onDismiss when dismissed or when already seen/skipped
    expect(motivationSrc).toContain('callbacks.current.onDismiss()');
  });

  it('prevents ExperienceReviewPopup from appearing during any tour or before the client has visited the charts', () => {
    // Tracks chart visits per user email
    expect(appSrc).toContain('hasVisitedChartsRef.current.add(currentUser.email.trim().toLowerCase())');
    expect(appSrc).toContain('if (!hasVisitedChartsRef.current.has(normEmail)) return;');

    // Blocks triggerOnceExperiencePopup during any tour, welcome modal, or session setup modal
    expect(appSrc.replace(/\r\n/g, '\n')).toContain(
      'isTourOpen ||\n        isWorkspaceTourOpen ||\n        motivationOpen ||\n        isCreateSessionModalOpen'
    );

    // Also gates ExperienceReviewPopup isOpen directly against active tours and welcome modal
    expect(appSrc).toContain('!isTourOpen &&');
    expect(appSrc).toContain('!isWorkspaceTourOpen &&');
    expect(appSrc).toContain('!motivationOpen');
  });

  it('measures GuidedTour spotlight target synchronously when found so no false hidden warning flashes', () => {
    expect(guidedTourSrc).toContain("el.scrollIntoView({ block: 'nearest', inline: 'nearest' })");
    expect(guidedTourSrc).toContain('setTargetEl(el);');
    expect(guidedTourSrc).toContain('setSearching(false);');
  });
});
