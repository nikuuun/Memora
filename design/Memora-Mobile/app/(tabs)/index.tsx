import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { usePhotos } from '../../src/photos/usePhotos';
import { useTrashCount } from '../../src/trash/store';
import { colors } from '../../src/theme';
const ALL = { type: 'all', year: null } as const;
export default function HomeScreen() {
  return <SafeAreaView style={s.safe} edges={['top']}><PermissionGate><Home /></PermissionGate></SafeAreaView>;
}
function Home() {
  const { assets } = usePhotos(ALL);
  const trashCount = useTrashCount();
  const recent = useMemo(() => assets.slice(0, 9), [assets]);
  return <ScrollView contentContainerStyle={s.content}>
    <View style={s.top}><Text style={s.logo}>memora<Text style={s.dot}>.</Text></Text>
      <Pressable onPress={() => router.push('/review')} style={s.review}>
        <Ionicons name="trash-outline" size={18} color={colors.ink} />
        <Text style={s.reviewText}>{trashCount > 0 ? `Review ${trashCount}` : 'Trash'}</Text>
      </Press></View>
    <Text style={s.eyebrow}>A HOME FOR YOUR MOMENTS</Text>
    <Text style={s.headline}>Your memories,{'\n'}beautifully kept.</Text>
    <Text style={s.intro}>Turn a camera roll full of moments into stories worth keeping — thoughtfully and simply.</Text>
    <Pressable style={s.primary} onPress={() => router.push('/(tabs)/library')}>
      <Text style={s.primaryText}>Explore your library</Text><Ionicons name="arrow-forward" size={18} color="#FFF" />
    </Press>
    <View style={s.sectionRow}><Text style={s.section}>Recent moments</Text>
      <Pressable onPress={() => router.push('/(tabs)/library')}><Text style={s.link}>See all  →</Text></Press></View>
    {recent.length ? <View style={s.grid}>{recent.map(p => <Image key={p.id} source={{uri:p.uri}} style={s.photo} />)}</View>
      : <View style={s.empty}><Ionicons name="images-outline" size={28} color={colors.muted}/><Text style={s.emptyText}>Your recent photos will appear here.</Text></View>}
    <View style={s.sectionRow}><Text style={s.section}>Make room for more</Text></View>
    <Pressable style={s.feature} onPress={() => router.push('/(tabs)/clean')}>
      <View style={s.featureIcon}><Ionicons name="sparkles-outline" size={25} color={colors.ink}/></View>
      <View style={{flex:1}}><Text style={s.featureTitle}>A little photo refresh</Text>
        <Text style={s.featureText}>Swipe through your photos, keep favorites, and review before deleting.</Text></View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted}/></Press>
    <Text style={s.footer}>THE LITTLE THINGS ARE THE BIG THINGS.</Text>
  </ScrollView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.bg},content:{paddingHorizontal:23,paddingBottom:45},
 top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:12,marginBottom:38},
 logo:{fontSize:28,fontWeight:'700',letterSpacing:-1.5,color:colors.ink},dot:{color:'#B88A73'},
 review:{flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:colors.line,borderRadius:25,paddingHorizontal:12,paddingVertical:9},
 reviewText:{fontSize:12,color:colors.ink,fontWeight:'600'},eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:2.5,color:'#9B806C',marginBottom:14},
 headline:{fontFamily:'Georgia',fontSize:40,lineHeight:47,color:colors.ink,letterSpacing:-1.3},
 intro:{fontSize:14,lineHeight:23,color:colors.muted,marginTop:15,maxWidth:315},
 primary:{backgroundColor:colors.ink,borderRadius:9,paddingVertical:16,paddingHorizontal:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:25,marginBottom:34},
 primaryText:{fontSize:14,color:'#FFF',fontWeight:'600'},sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14,marginTop:6},
 section:{fontFamily:'Georgia',fontSize:24,color:colors.ink},link:{fontSize:12,fontWeight:'600',color:colors.muted},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:5,marginBottom:29},photo:{width:'32.3%',aspectRatio:1,borderRadius:6,backgroundColor:colors.line},
 empty:{borderWidth:1,borderColor:colors.line,borderRadius:12,padding:32,alignItems:'center',gap:12,marginBottom:30},
 emptyText:{color:colors.muted,fontSize:13},feature:{backgroundColor:colors.surface,borderRadius:14,borderWidth:1,borderColor:colors.line,padding:16,flexDirection:'row',alignItems:'center',gap:13},
 featureIcon:{backgroundColor:'#E8E6D9',padding:12,borderRadius:12},featureTitle:{fontSize:15,fontWeight:'700',color:colors.ink,marginBottom:5},
 featureText:{fontSize:12,lineHeight:18,color:colors.muted},footer:{textAlign:'center',fontSize:9,letterSpacing:2,color:'#A7A294',marginTop:40},
});
