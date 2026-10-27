"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import type { Group } from "@/types/database";

const groupColors = ["from-blue-500 to-cyan-500", "from-purple-500 to-pink-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-rose-500 to-red-500", "from-indigo-500 to-violet-500"];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), "groups"), orderBy("name")));
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
    } catch (err) {
      console.error("Error loading groups:", err);
      toast.error("Error al cargar la lista de grupos");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() { setEditing(null); setForm({ name: "", description: "" }); setShowModal(true); }
  function openEdit(g: Group) { setEditing(g); setForm({ name: g.name, description: g.description || "" }); setShowModal(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("El nombre del grupo es obligatorio"); return; }
    try {
      if (editing) {
        await updateDoc(doc(getFirebaseDb(), "groups", editing.id), form);
        await logAction("update", "groups", editing.id, form);
        toast.success("Grupo actualizado");
      } else {
        await addDoc(collection(getFirebaseDb(), "groups"), { ...form, created_at: new Date().toISOString() });
        await logAction("create", "groups", null, form);
        toast.success("Grupo creado");
      }
      setShowModal(false); loadData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseDb(), "groups", id)); await logAction("delete", "groups", id, null);
      toast.success("Grupo eliminado"); setDeleteConfirm(null); loadData();
    } catch { toast.error("Error al eliminar. Verifique que no haya ninos asignados."); }
  }

  if (loading) return <LoadingSpinner label="Cargando grupos..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><UserGroupIcon className="w-6 h-6 text-white" /></div><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Grupos</h1><p className="text-sm text-gray-500 dark:text-gray-400">{groups.length} grupos registrados</p></div></div>
        <button onClick={openCreate} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex items-center gap-2"><PlusIcon className="w-4 h-4" />Crear Grupo</button>
      </div>
      {groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <div key={g.id} className="bg-white dark:bg-[#1a2438] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm group">
              <div className={`h-2 bg-gradient-to-r ${groupColors[i % groupColors.length]}`} />
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div><h3 className="text-lg font-bold text-gray-900 dark:text-white">{g.name}</h3><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{g.description || "Sin descripcion"}</p></div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openEdit(g)} aria-label="Editar grupo" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-primary/10 hover:text-primary transition-colors"><PencilIcon className="w-4 h-4" /></button><button onClick={() => setDeleteConfirm(g.id)} aria-label="Eliminar grupo" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"><TrashIcon className="w-4 h-4" /></button></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><UserGroupIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" /><p className="text-gray-700 dark:text-gray-300 font-medium">No hay grupos registrados</p><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Crea el primer grupo para organizar a los ninos</p></div>
      )}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Grupo" : "Crear Grupo"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre del grupo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ej: Caminadores" />
          <div><label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Descripcion (opcional)</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" placeholder="Describe el grupo..." /></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md">{editing ? "Actualizar" : "Crear"}</button></div>
        </form>
      </Modal>
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar eliminacion"><p className="text-gray-600 dark:text-gray-300">Estas seguro de eliminar este grupo?</p><div className="flex justify-end gap-3 mt-6"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-5 py-2.5 gradient-danger text-white font-semibold rounded-xl shadow-md">Eliminar</button></div></Modal>
    </div>
  );
}