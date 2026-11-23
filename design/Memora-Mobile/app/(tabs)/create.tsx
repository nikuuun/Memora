import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';
export default function CreateScreen() {
 return <View style={s.wrap}><Ionicons name="albums-outline" size={44} color={colors.muted}/><Text style={s.title}>Create a story</Text>
 <Text style={s.desc}>The Figma collage, journal and AI creation tools are design concepts. They are not connected to an AI or album-generation service yet.</Text></View>;
}
const s=StyleSheet.create({wrap:{flex:1,backgroundColor:colors.bg,alignItems:'center',justifyContent:'center',padding:30},title:{fontFamily:'Georgia',fontSize:30,color:colors.text,marginTop:16},desc:{fontSize:14,color:colors.muted,lineHeight:23,textAlign:'center',marginTop:12}});
