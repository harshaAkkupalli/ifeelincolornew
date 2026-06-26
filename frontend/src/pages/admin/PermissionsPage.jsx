import React, { useState, useEffect } from 'react';
import { Lock, Save, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import axios from 'axios';
const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const ax = axios.create({ withCredentials: true });

const PAGES = ['dashboard', 'patients', 'clinicians', 'organizations', 'assistants', 'plans', 'subscriptions', 'recommendations', 'earnings', 'assessments', 'announcements', 'payment_setup'];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

export default function PermissionsPage() {
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [perms, setPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    ax.get(`${API}/permissions`).then(r => setAdmins(r.data.admins || [])).catch(() => {});
    ax.get(`${API}/settings`).then(r => setSettings(r.data || {})).catch(() => {});
  }, []);

  const selectAdmin = (admin) => {
    setSelectedAdmin(admin);
    setPerms(admin.page_permissions || {});
    setSaved(false);
  };

  const togglePerm = (page, action) => {
    setPerms(p => {
      const current = p[page] || {};
      return { ...p, [page]: { ...current, [action]: !current[action] } };
    });
    setSaved(false);
  };

  const toggleAllPage = (page, checked) => {
    setPerms(p => {
      const newPagePerms = {};
      ACTIONS.forEach(a => { newPagePerms[a] = checked; });
      return { ...p, [page]: newPagePerms };
    });
    setSaved(false);
  };

  const savePerms = async () => {
    if (!selectedAdmin) return;
    setSaving(true);
    try {
      await ax.put(`${API}/permissions/${selectedAdmin.admin_id}`, { page_permissions: perms });
      setSaved(true);
      const r = await ax.get(`${API}/permissions`);
      setAdmins(r.data.admins || []);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const toggleDemoVisible = async (val) => {
    const updated = { ...settings, show_demo_credentials: val };
    setSettings(updated);
    await ax.put(`${API}/settings`, { show_demo_credentials: val });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold text-slate-800">Permissions & Settings</h1>
          <p className="text-sm text-slate-500">Configure granular page-level access for assistants and admins</p></div>
      </div>

      {/* Demo Toggle */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Demo Credentials Visibility</h3>
            <p className="text-xs text-slate-500 mt-0.5">Show or hide demo login section on the public landing page</p>
          </div>
          <Switch data-testid="demo-toggle" checked={settings.show_demo_credentials !== false} onCheckedChange={toggleDemoVisible} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Admin List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wider">Assistants / Admins</h3>
            <div className="space-y-1.5">
              {admins.map(a => (
                <button key={a.admin_id} onClick={() => selectAdmin(a)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${selectedAdmin?.admin_id === a.admin_id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.email}</p>
                </button>
              ))}
              {!admins.length && <p className="text-xs text-slate-400 py-4 text-center">No assistants created yet</p>}
            </div>
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="lg:col-span-3">
          {selectedAdmin ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{selectedAdmin.name}</h3>
                  <p className="text-xs text-slate-500">{selectedAdmin.email} &middot; {selectedAdmin.role}</p>
                </div>
                <Button onClick={savePerms} disabled={saving} className="rounded-lg text-xs bg-blue-600 text-white border-0">
                  {saved ? <Check className="w-3.5 h-3.5 mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  {saving ? 'Saving...' : saved ? 'Saved' : 'Save Permissions'}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium w-40">Page</th>
                      <th className="px-4 py-3 font-medium text-center">All</th>
                      {ACTIONS.map(a => <th key={a} className="px-3 py-3 font-medium text-center capitalize">{a}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PAGES.map(page => {
                      const pagePerms = perms[page] || {};
                      const allChecked = ACTIONS.every(a => pagePerms[a]);
                      return (
                        <tr key={page} className="border-t border-slate-50 text-xs">
                          <td className="px-4 py-2.5 font-medium text-slate-700 capitalize">{page.replace('_', ' ')}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Switch checked={allChecked} onCheckedChange={(v) => toggleAllPage(page, v)} className="scale-75" />
                          </td>
                          {ACTIONS.map(action => (
                            <td key={action} className="px-3 py-2.5 text-center">
                              <Switch checked={!!pagePerms[action]} onCheckedChange={() => togglePerm(page, action)} className="scale-75" />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
              <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Select an assistant to configure their permissions</p>
              <p className="text-xs text-slate-400 mt-1">Each permission controls access to specific pages and actions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
