import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';

export default function AddEmployeeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState({
    empcod: '', emplib: '', empmat: '', empsexe: 'M', empemail: '',
    foncod: '', quacod: '', soccod: user?.soccod || '', sitcod: user?.sitcod || '',
    empdatemb: '', empdatns: '', vilib: '', paycod: 'TN', empcin: '',
    emptel: '', empadr: '',
  });

  const handleScanDocument = async () => {
    try {
      Alert.alert('📷 Scanner un Document', 'Choisissez la source', [
        { text: 'Appareil Photo', onPress: () => scanFromCamera() },
        { text: 'Galerie', onPress: () => scanFromGallery() },
        { text: 'Fichier', onPress: () => scanFromFile() },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } catch (e) { Alert.alert('Erreur', 'Impossible d\'accéder au document'); }
  };

  const scanFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert('Erreur', 'Permission caméra requise'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      await processScannedDocument(result.assets[0].uri, 'image/jpeg');
    }
  };

  const scanFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      await processScannedDocument(result.assets[0].uri, 'image/jpeg');
    }
  };

  const scanFromFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
    if (!result.canceled && result.assets[0]) {
      await processScannedDocument(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
    }
  };

  const processScannedDocument = async (fileUri: string, fileType: string) => {
    setScanning(true);
    try {
      const result = await apiService.scanEmployeDocument(fileUri, fileType);
      if (result) {
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        setForm(prev => ({
          ...prev,
          emplib: data.nom || data.name || prev.emplib,
          empmat: data.matricule || data.mat || prev.empmat,
          empsexe: data.sexe || data.gender || prev.empsexe,
          empemail: data.email || prev.empemail,
          empdatns: data.dateNaissance || data.birthDate || prev.empdatns,
          empcin: data.cin || data.idNumber || prev.empcin,
          emptel: data.telephone || data.phone || prev.emptel,
          empadr: data.adresse || data.address || prev.empadr,
          vilib: data.ville || data.city || prev.vilib,
        }));
        Alert.alert('✅ IA', 'Document analysé avec succès! Vérifiez et complétez les informations.');
      }
    } catch (e) {
      Alert.alert('Erreur IA', 'Impossible d\'analyser le document. Remplissez manuellement.');
    } finally { setScanning(false); }
  };

  const handleSubmit = async () => {
    if (!form.emplib) { Alert.alert('Erreur', 'Le nom est obligatoire'); return; }
    if (!user?.soccod) return;
    setLoading(true);
    try {
      await apiService.addEmployee({
        ...form,
        empcod: form.empcod || `EMP${Date.now()}`,
        soccod: user.soccod,
      });
      Alert.alert('✅ Succès', 'Employé ajouté avec succès', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) { Alert.alert('Erreur', 'Impossible d\'ajouter l\'employé'); }
    finally { setLoading(false); }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.title}>Nouvel Employé</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* AI Scan Button */}
        <TouchableOpacity style={styles.aiButton} onPress={handleScanDocument} disabled={scanning}>
          {scanning ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.aiButtonText}> Analyse IA en cours...</Text>
            </View>
          ) : (
            <Text style={styles.aiButtonText}>🤖 Scanner avec IA (Caméra/Document)</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Informations Personnelles</Text>
        {[
          { key: 'emplib', label: 'Nom complet *', placeholder: 'Nom Prénom' },
          { key: 'empmat', label: 'Matricule', placeholder: 'MAT-001' },
          { key: 'empcin', label: 'CIN', placeholder: 'Numéro CIN' },
          { key: 'empdatns', label: 'Date naissance', placeholder: 'YYYY-MM-DD' },
          { key: 'empsexe', label: 'Sexe (M/F)', placeholder: 'M' },
        ].map(f => (
          <View key={f.key} style={styles.fieldContainer}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput style={styles.input} value={form[f.key as keyof typeof form]}
              onChangeText={(v: string) => updateField(f.key, v)} placeholder={f.placeholder} />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Contact</Text>
        {[
          { key: 'empemail', label: 'Email', placeholder: 'email@company.com', kb: 'email-address' },
          { key: 'emptel', label: 'Téléphone', placeholder: '+216 XX XXX XXX', kb: 'phone-pad' },
          { key: 'empadr', label: 'Adresse', placeholder: 'Adresse' },
        ].map(f => (
          <View key={f.key} style={styles.fieldContainer}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput style={styles.input} value={form[f.key as keyof typeof form]}
              onChangeText={(v: string) => updateField(f.key, v)} placeholder={f.placeholder}
              keyboardType={f.kb as any} />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Professionnel</Text>
        {[
          { key: 'foncod', label: 'Fonction', placeholder: 'Code fonction' },
          { key: 'quacod', label: 'Qualification', placeholder: 'Code qualification' },
          { key: 'empdatemb', label: 'Date embauche', placeholder: 'YYYY-MM-DD' },
        ].map(f => (
          <View key={f.key} style={styles.fieldContainer}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput style={styles.input} value={form[f.key as keyof typeof form]}
              onChangeText={(v: string) => updateField(f.key, v)} placeholder={f.placeholder} />
          </View>
        ))}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Ajouter l'Employé</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', elevation: 2 },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600', marginRight: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  aiButton: { backgroundColor: '#6a1b9a', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20, elevation: 3 },
  aiButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginTop: 16, marginBottom: 8 },
  fieldContainer: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 14 },
  submitBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});