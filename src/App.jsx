import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  CheckSquare,
  Square,
  ArrowLeft,
  Trash2,
  MoreVertical,
  Calendar,
  Target,
  Layout,
  ListTodo,
  Download,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: 'AIzaSyCzDDTTpZMHT13H58ud2LBNgPRvVackZd4',
  authDomain: 'seguimientoproyectos-a9644.firebaseapp.com',
  projectId: 'seguimientoproyectos-a9644',
  storageBucket: 'seguimientoproyectos-a9644.firebasestorage.app',
  messagingSenderId: '904852309784',
  appId: '1:904852309784:web:67ce3e48ec99502734406d',
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Styles & UI Components ---
const Card = ({ children, className = '' }) => (
  <div
    className={`bg-white rounded-xl shadow-sm border border-slate-100 ${className}`}
  >
    {children}
  </div>
);

const ProgressBar = ({ total, completed }) => {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  let colorClass = 'bg-blue-500';
  if (percentage === 100) colorClass = 'bg-green-500';
  else if (percentage < 30) colorClass = 'bg-amber-500';

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1 text-slate-500 font-medium">
        <span>Progreso</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ease-out ${colorClass}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function ProjectFocusApp() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeView, setActiveView] = useState('dashboard'); // dashboard, create, detail
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form States
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newTaskText, setNewTaskText] = useState('');

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Auth error:', error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const projectsRef = collection(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'projects'
    );

    // Using simple query as per rules (no complex orderBy in simple mode)
    // We sort in memory
    const unsubscribe = onSnapshot(
      projectsRef,
      (snapshot) => {
        const projectsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort in memory: Created At desc
        projectsList.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });

        setProjects(projectsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching projects:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- Actions ---

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectTitle.trim() || !user) return;

    try {
      await addDoc(
        collection(db, 'artifacts', appId, 'users', user.uid, 'projects'),
        {
          title: newProjectTitle,
          description: newProjectDesc,
          createdAt: serverTimestamp(),
          tasks: [], // Array of { id, text, completed }
          status: 'active',
        }
      );
      setNewProjectTitle('');
      setNewProjectDesc('');
      setActiveView('dashboard');
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;
    try {
      await deleteDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'projects', projectId)
      );
      if (selectedProject?.id === projectId) {
        setActiveView('dashboard');
        setSelectedProject(null);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim() || !selectedProject) return;

    const newTask = {
      id: Date.now().toString(),
      text: newTaskText,
      completed: false,
    };

    const updatedTasks = [...(selectedProject.tasks || []), newTask];

    try {
      await updateDoc(
        doc(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'projects',
          selectedProject.id
        ),
        {
          tasks: updatedTasks,
        }
      );
      // Optimistic update for UI responsiveness
      setSelectedProject((prev) => ({ ...prev, tasks: updatedTasks }));
      setNewTaskText('');
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (taskId) => {
    if (!selectedProject) return;

    const updatedTasks = selectedProject.tasks.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );

    try {
      await updateDoc(
        doc(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'projects',
          selectedProject.id
        ),
        {
          tasks: updatedTasks,
        }
      );
      setSelectedProject((prev) => ({ ...prev, tasks: updatedTasks }));
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    if (!selectedProject) return;

    const updatedTasks = selectedProject.tasks.filter(
      (task) => task.id !== taskId
    );

    try {
      await updateDoc(
        doc(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'projects',
          selectedProject.id
        ),
        {
          tasks: updatedTasks,
        }
      );
      setSelectedProject((prev) => ({ ...prev, tasks: updatedTasks }));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Function to download projects as JSON
  const handleExportData = () => {
    if (projects.length === 0) {
      alert('No hay proyectos para exportar.');
      return;
    }

    // Create a clean version of the data (removing Firebase specific objects if needed, though JSON.stringify handles most well)
    const exportData = {
      exportDate: new Date().toISOString(),
      projects: projects,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_proyectos_${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Select project wrapper to ensure we have latest data
  const openProject = (project) => {
    setSelectedProject(project);
    setActiveView('detail');
  };

  // Sync selectedProject with real-time updates from 'projects' list
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find((p) => p.id === selectedProject.id);
      if (updated) setSelectedProject(updated);
    }
  }, [projects]);

  // --- Views ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {/* --- HEADER --- */}
      <header className="bg-indigo-600 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {activeView === 'dashboard' ? (
            <>
              <div className="flex items-center gap-2">
                <Layout className="w-6 h-6" />
                <h1 className="text-xl font-bold tracking-tight">
                  Mis Proyectos
                </h1>
              </div>
              <button
                onClick={handleExportData}
                title="Descargar copia local"
                className="p-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Respaldo</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setActiveView('dashboard')}
                className="p-1 hover:bg-indigo-700 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold truncate">
                {activeView === 'create'
                  ? 'Nuevo Proyecto'
                  : selectedProject?.title}
              </h1>
              {activeView === 'detail' && (
                <button
                  onClick={() => handleDeleteProject(selectedProject.id)}
                  className="ml-auto p-1 hover:bg-indigo-700 rounded-full text-indigo-100 hover:text-red-200 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        {/* --- DASHBOARD VIEW --- */}
        {activeView === 'dashboard' && (
          <div className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Card className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 border-none text-white">
                <div className="text-indigo-100 text-sm mb-1">Total</div>
                <div className="text-3xl font-bold">{projects.length}</div>
                <div className="text-indigo-200 text-xs mt-1">
                  Proyectos activos
                </div>
              </Card>
              <Card className="p-4 bg-white">
                <div className="text-slate-500 text-sm mb-1">Tareas</div>
                <div className="text-3xl font-bold text-slate-800">
                  {projects.reduce(
                    (acc, curr) =>
                      acc +
                      (curr.tasks?.filter((t) => !t.completed).length || 0),
                    0
                  )}
                </div>
                <div className="text-slate-400 text-xs mt-1">
                  Pendientes globales
                </div>
              </Card>
            </div>

            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-slate-700">
                Tus Proyectos
              </h2>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-300">
                <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-600">
                  Sin proyectos aún
                </h3>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  Empieza a organizar tus ideas hoy mismo.
                </p>
                <button
                  onClick={() => setActiveView('create')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-md hover:bg-indigo-700 transition-colors"
                >
                  Crear Primer Proyecto
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => {
                  const completed =
                    project.tasks?.filter((t) => t.completed).length || 0;
                  const total = project.tasks?.length || 0;

                  return (
                    <Card
                      key={project.id}
                      className="p-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <div onClick={() => openProject(project)}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-slate-800">
                            {project.title}
                          </h3>
                          {total > 0 && completed === total && (
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                              Completado
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-slate-500 text-sm mb-3 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <ProgressBar total={total} completed={completed} />
                        <div className="mt-3 flex items-center text-xs text-slate-400 gap-2">
                          <ListTodo className="w-3 h-3" />
                          <span>{total - completed} pendientes</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- CREATE PROJECT VIEW --- */}
        {activeView === 'create' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                Detalles del Proyecto
              </h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre del Proyecto
                  </label>
                  <input
                    type="text"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="Ej. Aprender React, Jardín Vertical..."
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Breve resumen de la meta..."
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all h-24 resize-none"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!newProjectTitle.trim()}
                    className="w-full bg-indigo-600 disabled:bg-indigo-300 text-white py-3 rounded-lg font-medium shadow-md active:bg-indigo-700 transition-colors"
                  >
                    Crear Proyecto
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* --- PROJECT DETAIL VIEW --- */}
        {activeView === 'detail' && selectedProject && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            {/* Summary Card */}
            <Card className="p-5 mb-4 bg-indigo-50 border-indigo-100">
              <div className="mb-3">
                <h2 className="text-xl font-bold text-slate-800 mb-1">
                  {selectedProject.title}
                </h2>
                <p className="text-slate-600 text-sm">
                  {selectedProject.description}
                </p>
              </div>
              <ProgressBar
                total={selectedProject.tasks?.length || 0}
                completed={
                  selectedProject.tasks?.filter((t) => t.completed).length || 0
                }
              />
            </Card>

            {/* Tasks List */}
            <div className="mb-20">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">
                Lista de Seguimiento
              </h3>

              <div className="space-y-2">
                {selectedProject.tasks && selectedProject.tasks.length > 0 ? (
                  selectedProject.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group flex items-center p-3 rounded-lg border transition-all ${
                        task.completed
                          ? 'bg-slate-50 border-slate-100'
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`flex-shrink-0 mr-3 transition-colors ${
                          task.completed
                            ? 'text-green-500'
                            : 'text-slate-300 hover:text-indigo-500'
                        }`}
                      >
                        {task.completed ? (
                          <CheckSquare className="w-6 h-6" />
                        ) : (
                          <Square className="w-6 h-6" />
                        )}
                      </button>

                      <span
                        className={`flex-grow text-sm ${
                          task.completed
                            ? 'text-slate-400 line-through decoration-slate-300'
                            : 'text-slate-700'
                        }`}
                      >
                        {task.text}
                      </span>

                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                    <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay puntos de seguimiento.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Add Task Input (Fixed Bottom) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-20">
              <div className="max-w-md mx-auto">
                <form onSubmit={handleAddTask} className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Agregar nuevo punto..."
                    className="flex-grow p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newTaskText.trim()}
                    className="bg-indigo-600 disabled:bg-slate-300 text-white p-3 rounded-lg shadow-md"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FAB for Dashboard (Add Project) */}
      {activeView === 'dashboard' && (
        <button
          onClick={() => setActiveView('create')}
          className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 active:scale-90 transition-all z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
