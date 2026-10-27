<?php
declare(strict_types=1);
// Local-only read adapter. This file contains no database credentials.
ini_set('display_errors','0');
ini_set('memory_limit','512M');
try {
 require '/opt/modx-local/config.local.php';
 $pdo=new PDO($database_dsn,$database_user,$database_password,[
  PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES=>false,
 ]);
 $filter="r.published=1 AND r.deleted=0 AND r.context_key='web' AND r.template IN(2,4,5,6,8,9,10,15,16,17,18) AND r.id<>3715 AND NOT EXISTS(SELECT 1 FROM modx_document_groups d WHERE d.document=r.id)";
 $records=$pdo->query("SELECT r.id,r.parent,r.template,r.class_key,r.uri,r.uri_override,r.alias,r.pagetitle,r.longtitle,r.description,r.menutitle,r.menuindex,r.hidemenu,r.publishedon,r.content,r.introtext FROM modx_site_content r WHERE ".$filter." ORDER BY r.id")->fetchAll();
 $tvs=$pdo->query("SELECT v.contentid,v.tmplvarid,v.value FROM modx_site_tmplvar_contentvalues v JOIN modx_site_content r ON r.id=v.contentid WHERE ".$filter." AND v.tmplvarid IN(1,2,3,4,5) ORDER BY v.contentid,v.tmplvarid")->fetchAll();
 $images=$pdo->query("SELECT f.id,f.product_id,f.parent,f.path,f.file,f.url,f.type,f.rank FROM modx_ms2_product_files f JOIN modx_site_content r ON r.id=f.product_id WHERE ".$filter." AND f.parent=0 AND f.type='image' ORDER BY f.product_id,f.rank,f.id")->fetchAll();
 $products=$pdo->query("SELECT p.id,p.image FROM modx_ms2_products p JOIN modx_site_content r ON r.id=p.id WHERE ".$filter)->fetchAll();
 $chunks=$pdo->query("SELECT id,name,snippet FROM modx_site_htmlsnippets WHERE name LIKE 'price\\_%' OR name LIKE 'Block\\_%' OR id IN(27,28,33,34,125) ORDER BY id")->fetchAll();
 $redirects=$pdo->query("SELECT pattern,target FROM modx_redirects WHERE active=1 AND (context_key='web' OR context_key='')")->fetchAll();
 $excluded=$pdo->query("SELECT r.id,r.template FROM modx_site_content r WHERE r.published=1 AND r.deleted=0 AND r.context_key='web' AND (r.template NOT IN(2,4,5,6,8,9,10,15,16,17,18) OR r.id=3715 OR EXISTS(SELECT 1 FROM modx_document_groups d WHERE d.document=r.id)) ORDER BY r.id")->fetchAll();
 $plugin=$pdo->query("SELECT plugincode FROM modx_site_plugins WHERE id=15")->fetchColumn();
 $pageVar='page';
 if(preg_match('/\\$pageVarKey\\s*=\\s*([\\x27\\x22])([A-Za-z0-9_]+)\\1/',$plugin,$m))$pageVar=$m[2];
 $pagination=['pageVar'=>$pageVar,'knownPathPattern'=>null];
 if(preg_match('/preg_match\\(\\s*([\\x22\\x27])(.+?)\\1\\s*,/s',$plugin,$m)){
  $safe=str_replace(['{$pageVarKey}','$pageVarKey'],[$pageVar,$pageVar],$m[2]);
  if(strlen($safe)<250&&!preg_match('/https?:|@|password|token|secret/i',$safe))$pagination['knownPathPattern']=$safe;
 }
 // Only the explicitly selected public default city; never export all city TV.
 $defaultCity=$pdo->query("SELECT r.id,r.pagetitle AS name,r.alias AS slug,v.value AS prepositional FROM modx_site_content r JOIN modx_site_tmplvar_contentvalues v ON v.contentid=r.id AND v.tmplvarid=7 WHERE r.id=344 AND r.parent=196 AND r.template=12 AND r.published=1 AND r.deleted=0 AND r.context_key='web' AND NOT EXISTS(SELECT 1 FROM modx_document_groups d WHERE d.document=r.id)")->fetch();
 $out=['records'=>$records,'tvs'=>$tvs,'images'=>$images,'products'=>$products,'chunks'=>$chunks,'redirects'=>$redirects,'excluded'=>$excluded,'pagination'=>$pagination,'defaultCity'=>$defaultCity];
 echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
} catch(Throwable $e) {
 fwrite(STDERR,"Public database export failed.\n");
 exit(1);
}
