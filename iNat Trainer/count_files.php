<?php
header('Content-Type: application/json');

function countFiles($species) {
    $directory = "images/" . $species;
    $fileCount = count(glob($directory . "/*.jpg"));
    return $fileCount;
}

if (isset($_GET['species'])) {
    $species = $_GET['species'];
    $count = countFiles($species);
    echo json_encode(['count' => $count]);
} else {
    echo json_encode(['error' => 'No species specified']);
}
?>