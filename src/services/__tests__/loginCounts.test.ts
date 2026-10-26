import{afterEach,describe,it,expect,vi}from'vitest';import{authenticateUserAccount,registerUserAccount}from'../storageAndAnalytics';import{localAdminProfiles}from'../platformAccounts';import{hasSeenChartAnnouncement,markChartAnnouncementSeen}from'../../components/ChartAnnouncement';import{hasSeenWorkspaceTour,markWorkspaceTourSeen}from'../../components/WorkspaceTour';
afterEach(()=>vi.unstubAllGlobals());
describe('legacy local login tracking',()=>{
  it('counts only successful login and never returns a password in the administrator projection',()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size;}});registerUserAccount('Test Person','person@example.invalid','test-password');expect(localAdminProfiles()[0].loginCount).toBe(1);authenticateUserAccount('person@example.invalid','wrong');expect(localAdminProfiles()[0].loginCount).toBe(1);authenticateUserAccount('person@example.invalid','test-password');expect(localAdminProfiles()[0].loginCount).toBe(2);expect(localAdminProfiles()[0].lastLoginAt).toBeTruthy();expect(JSON.stringify(localAdminProfiles())).not.toContain('passwordHash');expect(localAdminProfiles().some(user=>user.email==='trader@chartflow.io')).toBe(false);});
  it('persists personal letter and workspace tour completion across logins so they only appear once',()=>{
    const values=new Map<string,string>();
    vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size;}});
    const email='newtrader@example.invalid';
    expect(hasSeenChartAnnouncement(email)).toBe(false);
    expect(hasSeenWorkspaceTour(email)).toBe(false);
    markChartAnnouncementSeen(email);
    markWorkspaceTourSeen(email);
    expect(hasSeenChartAnnouncement(email)).toBe(true);
    expect(hasSeenWorkspaceTour(email)).toBe(true);
  });
});
