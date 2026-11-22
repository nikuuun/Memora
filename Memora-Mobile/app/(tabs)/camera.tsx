import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';
export default function CameraScreen() {
 return <View style={s.wrap}><Ionicons name="camera-outline" size={44} color={colors.muted}/><Text style={s.title}>Memora camera</Text>
 <Text style={s.desc}>A native camera with filters is planned. For now, your phone's existing photos are available in Library and Clean.</Text></View>;
}
const s=StyleSheet.create({wrap:{flex:1,backgroundColor:colors.bg,alignItems:'center',justifyContent:'center',padding:30},title:{fontFamily:'Georgia',fontSize:30,color:colors.text,marginTop:16},desc:{fontSize:14,color:colors.muted,lineHeight:23,textAlign:'center',marginTop:12}});
