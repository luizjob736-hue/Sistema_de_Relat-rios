import React, { useState, useEffect } from "react";
import { X, UserPlus, Key, Trash2, Edit3, Shield, User } from "lucide-react";

interface UserItem {
  id: string;
  username: string;
  role: 'admin' | 'editor';
  password?: string;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, showToast }) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<'admin' | 'editor'>("editor");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      showToast("Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setUsername("");
    setPassword("");
    setRole("editor");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword(""); // leave blank unless changing
    setRole(user.role);
    setIsFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast("Nome de usuário é obrigatório.");
      return;
    }
    if (!editingUser && !password) {
      showToast("Senha é obrigatória para novos usuários.");
      return;
    }

    try {
      const payload: any = {
        id: editingUser ? editingUser.id : `user-${Date.now()}`,
        username: username.trim(),
        role,
      };
      if (password) {
        payload.password = password;
      } else if (editingUser) {
        // keep existing or if api handles partial update
        // We can pass current password if editing and password is empty
        const found = users.find(u => u.id === editingUser.id);
        payload.password = found ? found.password : "123456";
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingUser ? "Usuário atualizado com sucesso!" : "Usuário criado com sucesso!");
        setIsFormOpen(false);
        fetchUsers();
      } else {
        showToast("Erro ao salvar usuário (nome duplicado?).");
      }
    } catch (err) {
      showToast("Erro de conexão ao salvar usuário.");
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (name.toLowerCase() === "admin") {
      showToast("Não é permitido excluir o usuário Administrador principal.");
      return;
    }
    if (confirm(`Tem certeza que deseja excluir o usuário "${name}"?`)) {
      try {
        await fetch(`/api/users/${id}`, { method: "DELETE" });
        showToast(`Usuário "${name}" excluído.`);
        fetchUsers();
      } catch (err) {
        showToast("Erro ao excluir usuário.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b-2 border-[#141414] bg-[#F2F1EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={20} />
            <h2 className="text-sm font-black uppercase tracking-wider text-[#141414]">Gerenciamento de Acessos</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#141414] hover:text-white border border-[#141414] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!isFormOpen ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-mono font-bold uppercase text-slate-600">
                  Total de usuários: {users.length}
                </span>
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-white text-xs font-bold uppercase border-2 border-[#141414] shadow-[2px_2px_0px_#C5C4C0] hover:bg-black active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
                >
                  <UserPlus size={14} /> Novo Usuário
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8 font-mono text-xs uppercase">Carregando usuários...</div>
              ) : (
                <div className="border-2 border-[#141414] overflow-hidden">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#F2F1EB] border-b-2 border-[#141414] uppercase font-mono text-[10px]">
                      <tr>
                        <th className="p-3 border-r border-[#141414]">Usuário</th>
                        <th className="p-3 border-r border-[#141414]">Perfil</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-bold border-r border-gray-200 flex items-center gap-2">
                            <User size={14} className="text-slate-500" />
                            {u.username}
                          </td>
                          <td className="p-3 border-r border-gray-200">
                            <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase border border-[#141414] ${u.role === 'admin' ? 'bg-[#141414] text-white' : 'bg-slate-200 text-slate-800'}`}>
                              {u.role === 'admin' ? 'Administrador' : 'Editor / Operador'}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              title="Editar / Redefinir Senha"
                              className="px-2 py-1 bg-[#F2F1EB] border border-[#141414] text-xs font-bold uppercase hover:bg-[#141414] hover:text-white transition-all shadow-[1px_1px_0px_#141414]"
                            >
                              <Edit3 size={12} className="inline mr-1" /> Editar
                            </button>
                            {u.username.toLowerCase() !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                title="Excluir Usuário"
                                className="px-2 py-1 bg-red-100 border border-[#141414] text-red-700 text-xs font-bold uppercase hover:bg-red-600 hover:text-white transition-all shadow-[1px_1px_0px_#141414]"
                              >
                                <Trash2 size={12} className="inline mr-1" /> Excluir
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveUser} className="space-y-4 max-w-md mx-auto">
              <h3 className="text-sm font-black uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                {editingUser ? `Editar Usuário: ${editingUser.username}` : "Criar Novo Usuário"}
              </h3>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">Nome de Usuário</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: Operador 16 ou Supervisor"
                  className="w-full p-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Senha {editingUser && "(Deixe em branco para manter a atual)"}
                </label>
                <input
                  type="password"
                  {...(!editingUser ? { required: true } : {})}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full p-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">Perfil de Acesso</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm focus:outline-none focus:bg-white font-mono"
                >
                  <option value="editor">Editor (Operador - Acesso a guias e edição)</option>
                  <option value="admin">Administrador (Acesso total)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 bg-gray-200 border-2 border-[#141414] font-bold text-xs uppercase hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#141414] text-white border-2 border-[#141414] font-black text-xs uppercase shadow-[3px_3px_0px_#C5C4C0] hover:bg-black"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
