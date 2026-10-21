#!/usr/bin/perl
# build-i18n.pl - builds the language files the app loads from i18n.js (the source; edit only i18n.js):
#   i18n/core.js     the engine (everything above "const translations = {") + I18N_V + I18N_CROSS + an empty translations
#   i18n/<lang>.js   one language: translations.<lang> = { ... };
#   i18n/focus.js    the ready-made "what matters today" titles of every language (title -> key), loaded only when needed
# The version (I18N_V) is read from index.html (i18n/core.js?v=N), so bump it there first, then run:
#   perl build-i18n.pl            (from the repo folder)
#   perl build-i18n.pl --check    (exit 1 if the files in i18n/ are not up to date)
use strict;
use warnings;
use FindBin;

my $root = $FindBin::Bin;
my $check = grep { $_ eq '--check' } @ARGV;
sub slurp { my ($p) = @_; open(my $fh, '<:raw', $p) or die "$p: $!"; local $/; my $c = <$fh>; close $fh; return $c; }

my $src = slurp("$root/i18n.js");
my $index = slurp("$root/index.html");
my ($ver) = $index =~ m{i18n/core\.js\?v=(\d+)} or die "index.html: no i18n/core.js?v=N\n";

my $start = index($src, "\nconst translations = {");
die "no 'const translations = {'\n" if $start < 0;
my $engine = substr($src, 0, $start + 1);
my $body = substr($src, $start + 1);

# language blocks: "xx: {" at column 0 ... "}," at column 0
my (@langs, %block);
while ($body =~ /^([a-z]{2}): \{\r?\n(.*?)^\},?\r?$/msg) {
    push @langs, $1;
    $block{$1} = $2;
}
die "found " . scalar(@langs) . " languages\n" if @langs < 2;
my @supported = $engine =~ /const SUPPORTED_LANGUAGES = \[([^\]]*)\]/ ? ($1 =~ /'([a-z]{2})'/g) : ();
my %have = map { $_ => 1 } @langs;
for my $l (@supported) { die "language $l is in SUPPORTED_LANGUAGES but not in translations\n" unless $have{$l}; }

sub val { my ($l, $k) = @_; return $block{$l} =~ /(?:^|[\s,{])\Q$k\E:\s*"((?:[^"\\]|\\.)*)"/ ? $1 : undef; }

my %out;
# the keys that code reads in every language (i18nAllValues)
my @cross = qw(nm_pos_1 nm_pos_2 nm_pos_3 nm_pos_4 nm_pos_dinner bag_ex_col_groceries);
my $crossJs = "const I18N_CROSS = {\n";
for my $k (@cross) {
    my @pairs;
    for my $l (@langs) { my $v = val($l, $k); push @pairs, "$l: \"$v\"" if defined $v; }
    die "cross key $k missing everywhere\n" unless @pairs;
    $crossJs .= "    $k: { " . join(', ', @pairs) . " },\n";
}
$crossJs .= "};\n";
$out{'core.js'} = "// נבנה אוטומטית מ-i18n.js (build-i18n.pl) - לא לערוך כאן\n" . $engine . "const I18N_V = '$ver';\n" . $crossJs . "const translations = {};\n";

for my $l (@langs) {
    $out{"$l.js"} = "// נבנה אוטומטית מ-i18n.js (build-i18n.pl) - לא לערוך כאן\ntranslations.$l = {\n" . $block{$l} . "};\n";
}

my (%seen, @focus);
for my $l (@langs) {
    while ($block{$l} =~ /(?:^|[\s,{])(daily_focus_p\d+_d\d+_s\d+):\s*"((?:[^"\\]|\\.)*)"/g) {
        my ($k, $v) = ($1, $2);
        next if $seen{$v}++;
        push @focus, "\"$v\": \"$k\"";
    }
}
$out{'focus.js'} = "// נבנה אוטומטית מ-i18n.js (build-i18n.pl) - לא לערוך כאן\nconst I18N_FOCUS = {\n" . join(",\n", @focus) . "\n};\n";

my $dir = "$root/i18n";
mkdir $dir unless -d $dir;
my $stale = 0;
for my $f (sort keys %out) {
    my $p = "$dir/$f";
    my $cur = -e $p ? slurp($p) : '';
    next if $cur eq $out{$f};
    $stale++;
    if ($check) { print "STALE i18n/$f\n"; next; }
    open(my $fh, '>:raw', $p) or die "$p: $!";
    print $fh $out{$f};
    close $fh;
}
# files of languages that no longer exist
opendir(my $dh, $dir) or die;
for my $f (grep { /\.js$/ } readdir $dh) {
    next if exists $out{$f};
    $stale++;
    if ($check) { print "EXTRA i18n/$f\n"; } else { unlink "$dir/$f"; }
}
closedir $dh;
my $total = 0; $total += length($out{$_}) for keys %out;
printf "%s: %d languages, version %s, %d file(s) %s, core %d KB, largest language %d KB\n",
    $check ? 'check' : 'build', scalar(@langs), $ver, $stale, $check ? 'stale' : 'written',
    length($out{'core.js'}) / 1024, (sort { $b <=> $a } map { length($out{"$_.js"}) } @langs)[0] / 1024;
exit($check && $stale ? 1 : 0);
