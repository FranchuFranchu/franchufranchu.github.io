
MathJax.Hub.Config({
  asciimath2jax: {delimiters: [['`','`'],['``','``']]},
  AsciiMath: {displaystyle: false}
});
MathJax.Hub.Register.LoadHook("[MathJax]/extensions/asciimath2jax.js",function () {
  var AM = MathJax.Extension.asciimath2jax,
  CREATEPATTERNS = AM.createPatterns;
  AM.createPatterns = function () {
    var result = CREATEPATTERNS.call(this);
    this.match['``'].mode = ";mode=display";
    return result;
  };
});
MathJax.Hub.Register.StartupHook("AsciiMath Jax Ready",function () {
  var AM = MathJax.InputJax.AsciiMath;
  AM.postfilterHooks.Add(function (data) {
    if (data.script.type.match(/;mode=display/))
    {data.math.root.display = "block"}
    return data;
  });
});