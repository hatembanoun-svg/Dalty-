const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

const MESSAGES = {
    next: {
        ar: { title: "🔔 اقترب دورك!", body: (role) => `تبقى مريض واحد فقط قبلك (دورك #${role})، يرجى التوجه للعيادة الآن` },
        en: { title: "🔔 Your turn is close!", body: (role) => `Only one patient remains before you (your number #${role}), please head to the clinic now` },
        fr: { title: "🔔 Votre tour approche !", body: (role) => `Il ne reste qu'un seul patient avant vous (votre numéro #${role}), veuillez vous rendre à la clinique` },
    },
    turn: {
        ar: { title: "🎉 حان دورك الآن!", body: () => "تفضل بالدخول، الطبيب بانتظارك" },
        en: { title: "🎉 It's your turn now!", body: () => "Please come in, the doctor is waiting for you" },
        fr: { title: "🎉 C'est votre tour maintenant !", body: () => "Veuillez entrer, le médecin vous attend" },
    }
};

// دالة قابلة للاستدعاء مباشرة من لوحة الإدارة (admin.html) عند استدعاء مريض تالٍ
exports.notifyPatient = onCall(async (request) => {
    const { clinicId, appointmentId, kind } = request.data || {};

    if (!clinicId || !appointmentId || !kind || !MESSAGES[kind]) {
        throw new HttpsError("invalid-argument", "clinicId و appointmentId و kind (next|turn) مطلوبة");
    }

    const ref = db.collection("clinics").doc(clinicId).collection("appointments").doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new HttpsError("not-found", "الحجز غير موجود");
    }

    const appointment = snap.data();
    if (!appointment.fcmToken) {
        return { sent: false, reason: "no-token" };
    }

    const lang = appointment.lang && MESSAGES[kind][appointment.lang] ? appointment.lang : "ar";
    const msg = MESSAGES[kind][lang];

    try {
        await getMessaging().send({
            token: appointment.fcmToken,
            notification: {
                title: msg.title,
                body: msg.body(appointment.role)
            },
            webpush: {
                fcmOptions: { link: "/" },
                notification: { icon: "https://cdn-icons-png.flaticon.com/512/3774/3774299.png" }
            }
        });
        return { sent: true };
    } catch (err) {
        console.error("FCM send error:", err);
        return { sent: false, reason: err.message };
    }
});
