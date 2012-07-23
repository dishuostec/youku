<?php
/* =============================================================
 * Youku parser v0.1
 * https://github.com/dishuostec/youku
 * ============================================================ */

header('Content-Type: text/html; charset=utf-8');

$id = $_GET['u'];
$type = empty($_GET['t']) ? 'flv' : $_GET['t'];

if ( strpos($id, 'v.youku.com') !== FALSE ) {
  if (preg_match('%(?<=v_show/id_)[a-zA-Z0-9]+%', $id, $regs)) {
    $id = $regs[0];
  } else {
    header('HTTP/1.1 400 Bad Request', true, 400);
    exit('Invalid ID');
  }
} elseif ( ! preg_match('/\A[a-zA-Z0-9]+\Z/', $id)) {
  header('HTTP/1.1 400 Bad Request', true, 400);
  exit('Invalid ID');
}

$movie = new Youku($id);

$list = $movie->get_list($type);

echo json_encode($list);

class Youku 
{
  public function __construct ($id)
  {
    $data = file_get_contents('http://v.youku.com/player/getPlayList/VideoIDS/'.$id);

    if ( $data === FALSE ) {
      header('HTTP/1.1 404 Not Found', true, 404);
      exit('Invalid ID');
    }

    $data = json_decode($data);
    $data = $data->data[0];

    $keys = 'seed,key1,key2,streamfileids,segs';

    foreach (explode(',', $keys) as $key) {
      $this->$key = $data->$key;
    }
  }

  public function get_list($type = 'flv')
  {
    $list = array();
    foreach ($this->segs->$type as $seg) {
      $num = sprintf('%02X', $seg->no);
      $sid = $this->get_sid();
      $file_id = $this->get_file_id($type);
      $key = $seg->k ? $seg->k : $this->get_key();

      $file_id = substr($file_id, 0, 8).$num.substr($file_id, 10);

      $list[] = sprintf(
        'http://f.youku.com/player/getFlvPath/sid/%s_%s/st/%s/fileid/%s?K=%s',
        $sid, $num, $type, $file_id, $key);
    }

    return $list;
  }

  private function get_sid()
  {
    return time().(rand(0, 9000)+10000);
  }

  private function get_mixed_seed()
  {
    if ( ! $this->mixed) {
      $seed = $this->seed;
      $mixed = "";  
      $source = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/\\:._-1234567890";  
      $len = strlen($source);  

      for($i=0;$i<$len;++$i){  
        $seed = ($seed * 211 + 30031)%65536;  
        $index = ($seed / 65536 * strlen($source));  
        $c = substr($source, $index, 1);  
        $mixed .= $c;  
        $source = str_replace($c, "", $source);  
      }  

      $this->mixed = $mixed;
    }

    return $this->mixed;
  }

  private function get_file_id($type)
  {
    if ( ! $this->file_id) {

      $mixed = $this->get_mixed_seed();
      $ids = explode("*", $this->streamfileids->$type);  
      unset($ids[count($ids)-1]);  
      $file_id = "";  

      for ($i=0; $i < count($ids); ++$i){  
        $idx = $ids[$i];  
        $file_id .= substr($mixed, $idx, 1);  
      }  

      $this->file_id = $file_id;
    }

    return $this->file_id;
  }

  private function get_key()
  {
    if ( ! $this->key) {
      $a = hexdec($this->key1);  
      $b = $a ^0xA55AA5A5;  
      $b = dechex($b);  
      $this->key = $this->key2.$b;  
    }

    return $this->key;
  }
}
