import React, { useState, useEffect } from "react";
import { 
  X, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Shield, 
  User, 
  Lock, 
  Unlock, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Ban,
  ShieldCheck,
  ShieldAlert,
  FolderLock,
  Moon
} from "lucide-react";
import { UserRole, ReportSchema, UserItem, UserPresence } from "../types";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  schemas?: ReportSchema[];
  onSchemaUpdated?: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  showToast,
  schemas = [],
  onSchemaUpdated
}) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [presences, setPresences] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [blockedGuides, setBlockedGuides] = useState<string[]>([]);

  const fetchUsers = async () => {
    try {
      const [resUsers, resPres] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/users/presence")
      ]);
      const data = await resUsers.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
      if (resPres.ok) {
        const pData = await resPres.json();
        setPresences(pData);
      }
    } catch (err) {
      showToast("Erro ao carregar usuários.", 'error');
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
    setIsBlocked(false);
    setBlockedGuides([]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword(""); // leave blank unless changing
    setRole(user.role);
    setIsBlocked(Boolean(user.isBlocked));
    setBlockedGuides(Array.isArray(user.blockedGuides) ? user.blockedGuides : []);
    setIsFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast("Nome de usuário é obrigatório.", 'warning');
      return;
    }
    if (!editingUser && !password) {
      showToast("Senha é obrigatória para novos usuários.", 'warning');
      return;
    }

    try {
      const payload: any = {
        id: editingUser ? editingUser.id : `user-${Date.now()}`,
        username: username.trim(),
        role,
        isBlocked: username.trim().toLowerCase() === 'admin' ? false : isBlocked,
        blockedGuides: blockedGuides,
      };
      if (password) {
        payload.password = password;
      } else if (editingUser) {
        const found = users.find(u => u.id === editingUser.id);
        payload.password = found ? found.password : "123456";
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(
          editingUser ? `Usuário "${username}" atualizado com sucesso!` : `Usuário "${username}" criado com sucesso!`,
          'success'
        );
        setIsFormOpen(false);
        fetchUsers();
      } else {
        showToast("Erro ao salvar usuário (nome duplicado?).", 'error');
      }
    } catch (err) {
      showToast("Erro de conexão ao salvar usuário.", 'error');
    }
  };

  const handleToggleBlock = async (u: UserItem) => {
    if (u.role === 'admin' || u.username.toLowerCase() === 'admin') {
      showToast("O Administrador principal não pode ser bloqueado.", 'warning');
      return;
    }

    const nextState = !u.isBlocked;
    setIsProcessingAction(u.id);

    try {
      const res = await fetch(`/api/users/${u.id}/toggle-block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: nextState }),
      });

      if (res.ok) {
        setUsers(prev => prev.map(item => item.id === u.id ? { ...item, isBlocked: nextState } : item));
        showToast(
          nextState 
            ? `Usuário "${u.username}" BLOQUEADO! Ele não poderá entrar nas guias.` 
            : `Usuário "${u.username}" DESBLOQUEADO com sucesso!`,
          nextState ? 'warning' : 'success'
        );
      } else {
        showToast("Erro ao alterar bloqueio do usuário.", 'error');
      }
    } catch (e) {
      showToast("Erro de rede ao alternar status.", 'error');
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleBlockAllOperators = async () => {
    if (!confirm("Tem certeza que deseja BLOQUEAR o acesso de todos os operadores e visualizadores às guias? Apenas administradores terão acesso.")) {
      return;
    }
    setIsProcessingAction('all');
    try {
      const res = await fetch("/api/users/block-all-operators", { method: "POST" });
      if (res.ok) {
        showToast("TODOS os operadores foram bloqueados com sucesso!", 'warning');
        fetchUsers();
      } else {
        showToast("Falha ao bloquear operadores.", 'error');
      }
    } catch (e) {
      showToast("Erro de rede ao bloquear operadores.", 'error');
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleUnblockAllOperators = async () => {
    if (!confirm("Deseja DESBLOQUEAR o acesso de todos os operadores para que eles possam utilizar as guias normalmente?")) {
      return;
    }
    setIsProcessingAction('all');
    try {
      const res = await fetch("/api/users/unblock-all-operators", { method: "POST" });
      if (res.ok) {
        showToast("TODOS os operadores foram liberados com sucesso!", 'success');
        fetchUsers();
      } else {
        showToast("Falha ao liberar operadores.", 'error');
      }
    } catch (e) {
      showToast("Erro de rede ao liberar operadores.", 'error');
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (name.toLowerCase() === "admin") {
      showToast("Não é permitido excluir o usuário Administrador principal.", 'warning');
      return;
    }
    if (confirm(`Tem certeza que deseja excluir permanentemente o usuário "${name}"?`)) {
      try {
        await fetch(`/api/users/${id}`, { method: "DELETE" });
        showToast(`Usuário "${name}" excluído.`, 'info');
        fetchUsers();
      } catch (err) {
        showToast("Erro ao excluir usuário.", 'error');
      }
    }
  };

  const toggleBlockedGuide = (schemaId: string) => {
    setBlockedGuides(prev => {
      if (prev.includes(schemaId)) {
        return prev.filter(id => id !== schemaId);
      } else {
        return [...prev, schemaId];
      }
    });
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          u.role.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'active') return !u.isBlocked;
    if (statusFilter === 'blocked') return !!u.isBlocked;
    return true;
  });

  const totalBlockedCount = users.filter(u => u.isBlocked && u.role !== 'admin').length;
  const totalActiveCount = users.filter(u => !u.isBlocked).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-[#141414] shadow-[10px_10px_0px_rgba(0,0,0,1)] w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b-2 border-[#141414] bg-[#F2F1EB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center shadow-[2px_2px_0px_#C5C4C0]">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-[#141414]">
                Controle de Acessos & Bloqueio de Usuários
              </h2>
              <p className="text-[10px] font-mono text-slate-600 font-bold uppercase">
                Acesso total de administrador para bloquear ou liberar entrada nas guias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#141414] hover:text-white border-2 border-[#141414] transition-colors cursor-pointer shadow-[2px_2px_0px_#141414] active:translate-y-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!isFormOpen ? (
            <div>
              {/* Top Banner with Quick Actions */}
              <div className="bg-[#FAF9F5] border-2 border-[#141414] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_#141414]">
                <div>
                  <div className="text-xs font-black uppercase text-[#141414] flex items-center gap-2">
                    <ShieldAlert size={16} className={totalBlockedCount > 0 ? "text-red-600" : "text-emerald-700"} />
                    <span>Status Geral dos Operadores:</span>
                    {totalBlockedCount > 0 ? (
                      <span className="bg-red-100 text-red-800 border border-red-500 text-[10px] px-2 py-0.5 font-mono font-bold">
                        {totalBlockedCount} usuário(s) bloqueado(s)
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-500 text-[10px] px-2 py-0.5 font-mono font-bold">
                        Todos liberados
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                    Usuários bloqueados não conseguem visualizar nem editar nenhuma das guias de atendimento.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleBlockAllOperators}
                    disabled={isProcessingAction === 'all'}
                    title="Bloquear todos os operadores de uma só vez"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-900 border-2 border-[#141414] text-[11px] font-black uppercase hover:bg-red-200 transition-all shadow-[2px_2px_0px_#141414] active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <Ban size={13} className="text-red-700" />
                    <span>Bloquear Todos</span>
                  </button>

                  <button
                    onClick={handleUnblockAllOperators}
                    disabled={isProcessingAction === 'all'}
                    title="Liberar todos os operadores"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-900 border-2 border-[#141414] text-[11px] font-black uppercase hover:bg-emerald-200 transition-all shadow-[2px_2px_0px_#141414] active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <Unlock size={13} className="text-emerald-700" />
                    <span>Liberar Todos</span>
                  </button>
                </div>
              </div>

              {/* Filters and New User bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 mb-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Search box */}
                  <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar operador..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-[#F2F1EB] border-2 border-[#141414] text-xs font-medium focus:outline-none focus:bg-white"
                    />
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center border-2 border-[#141414] overflow-hidden bg-white text-[10px] font-bold uppercase">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1.5 transition-colors ${statusFilter === 'all' ? 'bg-[#141414] text-white' : 'hover:bg-gray-100 text-slate-700'}`}
                    >
                      Todos ({users.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('active')}
                      className={`px-2.5 py-1.5 border-l border-[#141414] transition-colors ${statusFilter === 'active' ? 'bg-emerald-800 text-white' : 'hover:bg-gray-100 text-slate-700'}`}
                    >
                      Ativos ({totalActiveCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('blocked')}
                      className={`px-2.5 py-1.5 border-l border-[#141414] transition-colors ${statusFilter === 'blocked' ? 'bg-red-800 text-white' : 'hover:bg-gray-100 text-slate-700'}`}
                    >
                      Bloqueados ({totalBlockedCount})
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleOpenCreate}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#141414] text-white text-xs font-black uppercase border-2 border-[#141414] shadow-[3px_3px_0px_#C5C4C0] hover:bg-black active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer"
                >
                  <UserPlus size={14} /> Novo Usuário
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12 font-mono text-xs uppercase text-slate-500">
                  Carregando lista de acessos...
                </div>
              ) : (
                <div className="border-2 border-[#141414] overflow-x-auto shadow-[3px_3px_0px_#141414]">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#F2F1EB] border-b-2 border-[#141414] uppercase font-mono text-[10px]">
                      <tr>
                        <th className="p-3 border-r border-[#141414]">Usuário</th>
                        <th className="p-3 border-r border-[#141414]">Perfil</th>
                        <th className="p-3 border-r border-[#141414]">Status do Acesso às Guias</th>
                        <th className="p-3 text-right">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-500 font-mono text-xs">
                            Nenhum usuário encontrado com os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isAdmin = u.role === 'admin' || u.username.toLowerCase() === 'admin';
                          const isUserBlocked = !isAdmin && !!u.isBlocked;
                          const hasRestrictedGuides = !isAdmin && Array.isArray(u.blockedGuides) && u.blockedGuides.length > 0;

                          return (
                            <tr 
                              key={u.id} 
                              className={`border-b border-gray-200 transition-colors ${
                                isUserBlocked ? 'bg-red-50/70 hover:bg-red-100/70' : 'hover:bg-gray-50'
                              }`}
                            >
                              <td className="p-3 font-bold border-r border-gray-200">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1 border border-[#141414] ${
                                    isAdmin ? 'bg-[#141414] text-white' : isUserBlocked ? 'bg-red-200 text-red-900' : 'bg-slate-200 text-slate-800'
                                  }`}>
                                    {isAdmin ? <ShieldCheck size={14} /> : isUserBlocked ? <Lock size={14} /> : <User size={14} />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      {(() => {
                                        const userPres = presences.find(p => p.username.toLowerCase() === u.username.toLowerCase());
                                        const isPresActive = userPres?.status === 'active';
                                        const isPresInactive = userPres?.status === 'inactive';
                                        return (
                                          <span 
                                            className={`w-2 h-2 rounded-full ${
                                              isPresActive ? 'bg-emerald-500 animate-pulse' :
                                              isPresInactive ? 'bg-amber-500' : 'bg-slate-300'
                                            }`} 
                                            title={isPresActive ? "Ativo no sistema agora" : isPresInactive ? "Inativo por ausência (>15 min sem uso)" : "Offline"}
                                          />
                                        );
                                      })()}
                                      <span className={isUserBlocked ? "line-through text-red-900" : "text-[#141414]"}>
                                        {u.username}
                                      </span>
                                    </div>
                                    {isAdmin ? (
                                      <span className="block text-[9px] font-mono text-slate-500 font-normal">
                                        Superusuário
                                      </span>
                                    ) : (() => {
                                      const userPres = presences.find(p => p.username.toLowerCase() === u.username.toLowerCase());
                                      if (userPres?.status === 'inactive') {
                                        return (
                                          <span className="text-[9px] font-mono font-bold text-amber-700 flex items-center gap-0.5">
                                            <Moon size={9} /> Inativo (&gt;15m)
                                          </span>
                                        );
                                      }
                                      if (userPres?.status === 'active') {
                                        return (
                                          <span className="text-[9px] font-mono font-bold text-emerald-700">
                                            ● Ativo agora
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                              </td>

                              <td className="p-3 border-r border-gray-200">
                                <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase border border-[#141414] ${
                                  u.role === 'admin' 
                                    ? 'bg-[#141414] text-white' 
                                    : u.role === 'viewer' 
                                      ? 'bg-blue-100 text-blue-900 border-blue-950' 
                                      : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {u.role === 'admin' ? 'Administrador' : u.role === 'viewer' ? 'Visualizador' : 'Editor / Operador'}
                                </span>
                              </td>

                              <td className="p-3 border-r border-gray-200">
                                {isAdmin ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-950 text-[10px] font-mono font-bold uppercase border border-emerald-600">
                                    <ShieldCheck size={11} className="text-emerald-700" /> Acesso Total (Imbloqueável)
                                  </span>
                                ) : isUserBlocked ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-mono font-black uppercase border border-red-950 shadow-xs animate-pulse">
                                    <Ban size={12} /> Bloqueado das Guias
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold uppercase border border-emerald-300">
                                      <CheckCircle2 size={11} className="text-emerald-600" /> Acesso Liberado
                                    </span>
                                    {hasRestrictedGuides && (
                                      <span className="block text-[9px] font-mono text-amber-800">
                                        ⚠️ {u.blockedGuides?.length} guia(s) restrita(s)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Quick 1-Click Block / Unblock Button */}
                                  {!isAdmin && (
                                    <button
                                      onClick={() => handleToggleBlock(u)}
                                      disabled={isProcessingAction === u.id}
                                      title={isUserBlocked ? "Liberar acesso às guias para este usuário" : "Bloquear entrada deste usuário nas guias"}
                                      className={`px-2.5 py-1 text-xs font-black uppercase border-2 border-[#141414] transition-all shadow-[1px_1px_0px_#141414] active:translate-y-0.5 cursor-pointer disabled:opacity-50 ${
                                        isUserBlocked
                                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                          : 'bg-red-100 text-red-800 hover:bg-red-600 hover:text-white'
                                      }`}
                                    >
                                      {isUserBlocked ? (
                                        <span className="flex items-center gap-1">
                                          <Unlock size={12} /> Liberar
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1">
                                          <Lock size={12} /> Bloquear
                                        </span>
                                      )}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleOpenEdit(u)}
                                    title="Editar perfil, senha e permissões"
                                    className="px-2.5 py-1 bg-[#F2F1EB] border-2 border-[#141414] text-xs font-bold uppercase hover:bg-[#141414] hover:text-white transition-all shadow-[1px_1px_0px_#141414] cursor-pointer"
                                  >
                                    <Edit3 size={12} className="inline mr-1" /> Editar
                                  </button>

                                  {!isAdmin && (
                                    <button
                                      onClick={() => handleDeleteUser(u.id, u.username)}
                                      title="Excluir Usuário"
                                      className="px-2 py-1 bg-gray-100 border border-[#141414] text-red-700 text-xs font-bold uppercase hover:bg-red-600 hover:text-white transition-all shadow-[1px_1px_0px_#141414] cursor-pointer"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveUser} className="space-y-4 max-w-lg mx-auto bg-white p-2">
              <div className="flex items-center justify-between border-b-2 border-[#141414] pb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-[#141414] flex items-center gap-2">
                  <User size={16} />
                  <span>{editingUser ? `Editar Usuário: ${editingUser.username}` : "Criar Novo Usuário"}</span>
                </h3>
                <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 border border-slate-300">
                  {editingUser ? "Modo de Edição" : "Novo Cadastro"}
                </span>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#141414]">
                  Nome de Usuário
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: Operador 16 ou Supervisor"
                  className="w-full p-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm focus:outline-none focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#141414]">
                  Senha {editingUser && "(Deixe em branco para manter a atual)"}
                </label>
                <input
                  type="password"
                  {...(!editingUser ? { required: true } : {})}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full p-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#141414]">
                  Perfil de Acesso
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm focus:outline-none focus:bg-white font-mono"
                >
                  <option value="editor">Editor / Operador (Edição e visualização das bases)</option>
                  <option value="viewer">Visualizador (Apenas leitura e exportação)</option>
                  <option value="admin">Administrador (Acesso total e gestão de bloqueios)</option>
                </select>
              </div>

              {/* Block Access Switch */}
              {role !== 'admin' && username.toLowerCase() !== 'admin' && (
                <div className="bg-[#FAF9F5] border-2 border-[#141414] p-3.5 space-y-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="isBlockedCheckbox"
                      checked={isBlocked}
                      onChange={(e) => setIsBlocked(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-red-600 cursor-pointer"
                    />
                    <div>
                      <label htmlFor="isBlockedCheckbox" className="text-xs font-black uppercase text-red-900 cursor-pointer flex items-center gap-1.5">
                        <Ban size={14} className="text-red-600" />
                        Bloquear Acesso Total às Guias
                      </label>
                      <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                        Quando marcado, o operador não conseguirá entrar no sistema nem visualizar nenhuma das bases de atendimento.
                      </p>
                    </div>
                  </div>

                  {/* Granular Guide Access Config */}
                  {!isBlocked && schemas.length > 0 && (
                    <div className="pt-2 border-t border-slate-300">
                      <label className="block text-[11px] font-black uppercase tracking-wider mb-1 text-[#141414] flex items-center gap-1">
                        <FolderLock size={13} /> Restrição por Guia Específica:
                      </label>
                      <p className="text-[10px] text-slate-500 font-mono mb-2">
                        Marque as guias que este usuário NÃO deve acessar:
                      </p>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto bg-white p-2 border border-[#141414]">
                        {schemas.map((s) => {
                          const isGuideBlocked = blockedGuides.includes(s.id);
                          return (
                            <label 
                              key={s.id} 
                              className={`flex items-center gap-2 p-1 text-xs cursor-pointer rounded ${
                                isGuideBlocked ? 'bg-red-50 text-red-900 font-bold' : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isGuideBlocked}
                                onChange={() => toggleBlockedGuide(s.id)}
                                className="w-3.5 h-3.5 accent-red-600"
                              />
                              <span>{s.name}</span>
                              {isGuideBlocked && (
                                <span className="ml-auto text-[9px] font-mono text-red-700 uppercase font-black">
                                  Bloqueada
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 bg-gray-200 border-2 border-[#141414] font-bold text-xs uppercase hover:bg-gray-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#141414] text-white border-2 border-[#141414] font-black text-xs uppercase shadow-[3px_3px_0px_#C5C4C0] hover:bg-black active:translate-y-0.5 cursor-pointer"
                >
                  Salvar Usuário & Acessos
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

