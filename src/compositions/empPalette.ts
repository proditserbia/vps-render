/** EMP R4: only the release-title colour is an editable palette input. */
export function empPalette(songTitleColor='#ff8732') {
  if (!/^#[0-9a-f]{6}$/i.test(songTitleColor)) throw new Error('Invalid songTitleColor');
  const channels=[1,3,5].map(start=>parseInt(songTitleColor.slice(start,start+2),16)/255)
    .map(c=>c<=0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4);
  const luminance=0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];
  return {
    songTitleColor,
    textColor:'#FFFFFF',
    videoTextColor:'#FFFFFF',
    backgroundColor:'#FFFFFF',
    bannerColor:songTitleColor,
    // Retain the reference's white-on-orange treatment; light backgrounds need dark text.
    bannerTextColor:luminance>0.6 ? '#212121' : '#FFFFFF',
  };
}
