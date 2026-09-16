import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  Wallet,
  PieChart,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Target,
  User,
  Users,
  LogOut,
  Trash2,
  CheckCircle2,
  X,
} from "lucide-react";

// CONFIGURACIÓN DE ENTORNO
const appId = typeof __app_id !== "undefined" ? __app_id : "sl-finance-tracker";
const defaultFirebaseConfig = {
  apiKey: "AIzaSyBmjq-ImnYZcB3C0JvZ_eDVTCDPDd0bsJQ",
  authDomain: "finanzas-sl-70c2d.firebaseapp.com",
  projectId: "finanzas-sl-70c2d",
  storageBucket: "finanzas-sl-70c2d.firebasestorage.app",
  messagingSenderId: "422980241906",
  appId: "1:422980241906:web:0e1cbb1aa241682832036b",
};

const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : defaultFirebaseConfig;

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Fallo al inicializar Firebase:", error);
}

const PROFILES = {
  sebastian: {
    name: "Sebastián",
    pin: "1234",
    color: "bg-blue-600",
    lightColor: "bg-blue-100",
    text: "text-blue-600",
  },
  luana: {
    name: "Luana",
    pin: "5678",
    color: "bg-rose-600",
    lightColor: "bg-rose-100",
    text: "text-rose-600",
  },
};

const CATEGORIES = [
  "Vivienda",
  "Comida y Súper",
  "Transporte",
  "Servicios",
  "Entretenimiento",
  "Compras",
  "Salud",
  "Ahorros",
  "Otros",
];

export default function App() {
  // Estado de Autenticación y Perfil
  const [userId, setUserId] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null); // 'sebastian' o 'luana'
  const [activeTab, setActiveTab] = useState("personal"); // 'personal' o 'joint'

  // Estado de Datos
  const [allPersonalTransactions, setAllPersonalTransactions] = useState([]);
  const [jointTransactions, setJointTransactions] = useState([]);
  const [objectives, setObjectives] = useState([]);

  // Estado de UI
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [isAddingObjective, setIsAddingObjective] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!auth) return;

    const authenticate = async () => {
      try {
        if (typeof __initial_auth_token !== "undefined") {
          const userCredential = await signInWithCustomToken(
            auth,
            __initial_auth_token,
          );
          setUserId(userCredential.user.uid);
        } else {
          const userCredential = await signInAnonymously(auth);
          setUserId(userCredential.user.uid);
        }
      } catch (err) {
        console.error("Error de Auth:", err);
        setErrorMsg(
          "Error al conectar con la base de datos. Verifica la configuración de Firebase.",
        );
      }
    };
    authenticate();
  }, []);

  useEffect(() => {
    if (!userId || !db) return;

    // Obtener transacciones personales
    const personalRef = collection(
      db,
      "artifacts",
      appId,
      "users",
      userId,
      "transactions",
    );
    const unsubPersonal = onSnapshot(
      personalRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllPersonalTransactions(data);
      },
      (error) => console.error("Error obteniendo datos personales:", error),
    );

    // Obtener transacciones compartidas
    const jointRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "joint_transactions",
    );
    const unsubJoint = onSnapshot(
      jointRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setJointTransactions(
          data.sort((a, b) => new Date(b.date) - new Date(a.date)),
        );
      },
      (error) => console.error("Error obteniendo datos compartidos:", error),
    );

    // Obtener objetivos compartidos
    const objRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "joint_objectives",
    );
    const unsubObj = onSnapshot(
      objRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setObjectives(data);
      },
      (error) => console.error("Error obteniendo objetivos:", error),
    );

    return () => {
      unsubPersonal();
      unsubJoint();
      unsubObj();
    };
  }, [userId]);

  const personalTransactions = useMemo(() => {
    if (!activeProfile) return [];
    return allPersonalTransactions
      .filter((t) => t.owner === activeProfile)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allPersonalTransactions, activeProfile]);

  const calculateMetrics = (transactions) => {
    let totalExpenses = 0;
    let totalSavings = 0;

    transactions.forEach((t) => {
      if (t.type === "expense") totalExpenses += parseFloat(t.amount);
      if (t.type === "savings") totalSavings += parseFloat(t.amount);
    });

    return { totalExpenses, totalSavings };
  };

  const personalMetrics = useMemo(
    () => calculateMetrics(personalTransactions),
    [personalTransactions],
  );
  const jointMetrics = useMemo(
    () => calculateMetrics(jointTransactions),
    [jointTransactions],
  );

  const addTransaction = async (transactionData) => {
    if (!userId || !db) return;
    try {
      if (activeTab === "personal") {
        await addDoc(
          collection(db, "artifacts", appId, "users", userId, "transactions"),
          {
            ...transactionData,
            owner: activeProfile,
            createdAt: new Date().toISOString(),
          },
        );
      } else {
        await addDoc(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "joint_transactions",
          ),
          {
            ...transactionData,
            addedBy: activeProfile,
            createdAt: new Date().toISOString(),
          },
        );
      }
      setIsAddingTransaction(false);
    } catch (err) {
      setErrorMsg("Error al agregar el registro.");
    }
  };

  const deleteTransaction = async (id, isJoint) => {
    if (!userId || !db) return;
    try {
      if (isJoint) {
        await deleteDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "joint_transactions",
            id,
          ),
        );
      } else {
        await deleteDoc(
          doc(db, "artifacts", appId, "users", userId, "transactions", id),
        );
      }
    } catch (err) {
      setErrorMsg("Error al eliminar el registro.");
    }
  };

  const addObjective = async (objectiveData) => {
    if (!userId || !db) return;
    try {
      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "joint_objectives",
        ),
        {
          ...objectiveData,
          currentAmount: 0,
          createdAt: new Date().toISOString(),
        },
      );
      setIsAddingObjective(false);
    } catch (err) {
      setErrorMsg("Error al agregar la meta.");
    }
  };

  const updateObjectiveProgress = async (id, newAmount) => {
    if (!userId || !db) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "joint_objectives", id),
        {
          currentAmount: parseFloat(newAmount),
        },
      );
    } catch (err) {
      setErrorMsg("Error al actualizar la meta.");
    }
  };

  const deleteObjective = async (id) => {
    if (!userId || !db) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "joint_objectives", id),
      );
    } catch (err) {
      setErrorMsg("Error al eliminar la meta.");
    }
  };

  if (!activeProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              Nuestras Finanzas
            </h1>
            <p className="text-slate-500 mt-2">
              Selecciona tu perfil para continuar
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium text-center">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ProfileButton
              id="sebastian"
              profile={PROFILES.sebastian}
              onSelect={setActiveProfile}
              setError={setErrorMsg}
            />
            <ProfileButton
              id="luana"
              profile={PROFILES.luana}
              onSelect={setActiveProfile}
              setError={setErrorMsg}
            />
          </div>
        </div>
      </div>
    );
  }

  const currentTheme = PROFILES[activeProfile];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24">
      {/* Header */}
      <header
        className={`${currentTheme.color} text-white px-6 py-8 rounded-b-[2.5rem] shadow-lg mb-8`}
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Hola, {currentTheme.name}</h1>
            <p className="text-white/80 text-sm mt-1">
              Sigamos nuestras metas.
            </p>
          </div>
          <button
            onClick={() => {
              setActiveProfile(null);
              setActiveTab("personal");
            }}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Tab Navigation */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm mb-6">
          <button
            onClick={() => setActiveTab("personal")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "personal"
                ? `${currentTheme.lightColor} ${currentTheme.text} shadow-sm`
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <User size={18} /> Personal
          </button>
          <button
            onClick={() => setActiveTab("joint")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "joint"
                ? "bg-teal-100 text-teal-700 shadow-sm"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Users size={18} /> Compartido
          </button>
        </div>

        {/* Dashboard Content */}
        {activeTab === "personal" ? (
          <DashboardView
            title="Mis Finanzas"
            metrics={personalMetrics}
            transactions={personalTransactions}
            onAdd={() => setIsAddingTransaction(true)}
            onDelete={(id) => deleteTransaction(id, false)}
            theme={currentTheme}
          />
        ) : (
          <div className="space-y-8">
            <DashboardView
              title="Finanzas Compartidas"
              metrics={jointMetrics}
              transactions={jointTransactions}
              onAdd={() => setIsAddingTransaction(true)}
              onDelete={(id) => deleteTransaction(id, true)}
              theme={{
                color: "bg-teal-600",
                lightColor: "bg-teal-100",
                text: "text-teal-700",
              }}
              isJoint={true}
            />

            <ObjectivesSection
              objectives={objectives}
              onAdd={() => setIsAddingObjective(true)}
              onUpdate={updateObjectiveProgress}
              onDelete={deleteObjective}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      {isAddingTransaction && (
        <TransactionModal
          onClose={() => setIsAddingTransaction(false)}
          onSubmit={addTransaction}
          isJoint={activeTab === "joint"}
        />
      )}

      {isAddingObjective && (
        <ObjectiveModal
          onClose={() => setIsAddingObjective(false)}
          onSubmit={addObjective}
        />
      )}
    </div>
  );
}

function ProfileButton({ id, profile, onSelect, setError }) {
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const handleVerify = (e) => {
    e.preventDefault();
    if (pinInput === profile.pin) {
      onSelect(id);
      setError("");
    } else {
      setError("PIN incorrecto.");
      setPinInput("");
    }
  };

  if (showPin) {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-2">
        <input
          type="password"
          maxLength={4}
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder="PIN"
          className="w-full text-center p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono tracking-widest text-lg"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPin(false)}
            className="flex-1 p-2 text-xs text-slate-500 bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`flex-1 p-2 text-xs text-white ${profile.color} rounded-lg`}
          >
            Ingresar
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      onClick={() => setShowPin(true)}
      className={`flex flex-col items-center p-6 rounded-2xl border-2 border-transparent hover:border-slate-100 transition-all ${profile.lightColor} hover:shadow-md`}
    >
      <div
        className={`w-16 h-16 rounded-full ${profile.color} text-white flex items-center justify-center mb-3 shadow-inner`}
      >
        <User size={32} />
      </div>
      <span className={`font-semibold ${profile.text}`}>{profile.name}</span>
    </button>
  );
}

function DashboardView({
  title,
  metrics,
  transactions,
  onAdd,
  onDelete,
  theme,
  isJoint = false,
}) {
  const formatMoney = (amount) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-full text-white ${theme.color} hover:opacity-90 transition-opacity shadow-sm`}
        >
          <Plus size={16} /> Agregar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ArrowDownCircle size={18} className="text-red-500" />
            <span className="text-sm font-medium">Gastos Totales</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatMoney(metrics.totalExpenses)}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ArrowUpCircle size={18} className="text-green-500" />
            <span className="text-sm font-medium">Total Ahorrado</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatMoney(metrics.totalSavings)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
          <h3 className="font-semibold text-slate-700">Registros Recientes</h3>
        </div>
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No hay registros. ¡Haz clic en "Agregar" para comenzar!
            </div>
          ) : (
            transactions.map((t) => (
              <div
                key={t.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${t.type === "expense" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}
                  >
                    {t.type === "expense" ? (
                      <Wallet size={20} />
                    ) : (
                      <PieChart size={20} />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {t.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{t.category}</span>
                      <span>•</span>
                      <span>
                        {new Date(t.date).toLocaleDateString("es-AR")}
                      </span>
                      {isJoint && (
                        <>
                          <span>•</span>
                          <span className="capitalize text-slate-600 font-medium">
                            Por {t.addedBy}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`font-bold ${t.type === "expense" ? "text-slate-800" : "text-green-600"}`}
                  >
                    {t.type === "expense" ? "-" : "+"}
                    {formatMoney(t.amount)}
                  </span>
                  <button
                    onClick={() => onDelete(t.id)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar registro"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ObjectivesSection({ objectives, onAdd, onUpdate, onDelete }) {
  const formatMoney = (amount) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="space-y-6 pt-6 border-t border-slate-200">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Target size={24} className="text-teal-600" />
            Nuestros Objetivos
          </h2>
          <p className="text-sm text-slate-500">
            Ahorrando juntos para nuestros planes.
          </p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-full text-teal-700 bg-teal-100 hover:bg-teal-200 transition-colors shadow-sm"
        >
          <Plus size={16} /> Agregar Meta
        </button>
      </div>

      <div className="grid gap-4">
        {objectives.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-sm border border-slate-100 shadow-sm">
            Aún no hay objetivos. ¡Establezcan una meta para empezar a ahorrar
            juntos!
          </div>
        ) : (
          objectives.map((obj) => {
            const progress = Math.min(
              100,
              Math.round((obj.currentAmount / obj.targetAmount) * 100),
            );
            return (
              <div
                key={obj.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative group"
              >
                <button
                  onClick={() => onDelete(obj.id)}
                  className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>

                <div className="mb-4 pr-8">
                  <h3 className="font-bold text-lg text-slate-800">
                    {obj.title}
                  </h3>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-teal-600 font-semibold">
                      {formatMoney(obj.currentAmount)} ahorrado
                    </span>
                    <span className="text-slate-500">
                      Meta: {formatMoney(obj.targetAmount)}
                    </span>
                  </div>
                </div>

                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">
                    {progress}% Completado
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Agregar monto..."
                      className="w-32 text-sm p-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            onUpdate(obj.id, obj.currentAmount + val);
                            e.target.value = "";
                          }
                        }
                      }}
                    />
                    <span className="text-xs text-slate-400 italic">
                      Presiona Enter
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TransactionModal({ onClose, onSubmit, isJoint }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !description) return;

    onSubmit({
      type,
      amount: parseFloat(amount),
      category,
      description,
      date,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">
            Agregar Registro {isJoint ? "Compartido" : ""}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${type === "expense" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"}`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => {
                setType("savings");
                setCategory("Ahorros");
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${type === "savings" ? "bg-white text-green-600 shadow-sm" : "text-slate-500"}`}
            >
              Ahorro
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Monto ($)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-2xl font-bold text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Descripción
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ej., Compras de la semana"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Fecha
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-4 rounded-xl text-white font-bold bg-slate-800 hover:bg-slate-900 transition-colors shadow-md"
          >
            Guardar Registro
          </button>
        </form>
      </div>
    </div>
  );
}

function ObjectiveModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !targetAmount) return;

    onSubmit({
      title,
      targetAmount: parseFloat(targetAmount),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-teal-50">
          <h3 className="font-bold text-lg text-teal-900">
            Nuevo Objetivo Compartido
          </h3>
          <button
            onClick={onClose}
            className="text-teal-400 hover:text-teal-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Nombre de la Meta
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="ej., Vacaciones en Brasil"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Monto Objetivo ($)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full text-2xl font-bold text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="0.00"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-4 rounded-xl text-white font-bold bg-teal-600 hover:bg-teal-700 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            <Target size={18} /> Crear Objetivo
          </button>
        </form>
      </div>
    </div>
  );
}
