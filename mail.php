<?php

//Taking all values
$name 		= $_POST['name'];
$email 		= $_POST['email'];
$msg 		= $_POST['msg'];
$output 	= "Name: ".$name."\n\nEmail: ".$email."\n\nMessage: ".$msg;

$to 		= 'dylan@cs.stanford.edu';
$headers	= 'FROM: "'.$email.'"';

$send		= mail($to, $name, $output."\n\n***This message has been sent from www.dylanedwardmoore.com", $headers);
?>